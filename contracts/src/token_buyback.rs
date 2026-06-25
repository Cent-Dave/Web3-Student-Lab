/// Token buyback program module
/// Handles automated token buyback configuration, frequency scheduling, and treasury management
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, Symbol,
    Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum BuybackError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    NotAuthorized = 3,
    InvalidPercentage = 4,
    InvalidFrequency = 5,
    InvalidLimits = 6,
    InsufficientTreasury = 7,
    BuybackNotDue = 8,
    InvalidAmount = 9,
    TransactionFailed = 10,
}

/// Buyback configuration settings
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BuybackConfig {
    /// Percentage of revenue allocated to buyback (0-100)
    pub revenue_percentage: u32,
    /// Frequency of buyback in seconds
    pub frequency: u64,
    /// Minimum amount that triggers a buyback
    pub min_buyback_amount: u128,
    /// Maximum amount per buyback transaction
    pub max_buyback_amount: u128,
    /// Owner/administrator of the buyback program
    pub admin: Address,
    /// DEX contract address for purchasing tokens
    pub dex_contract: Address,
    /// Treasury address holding accumulated revenue
    pub treasury: Address,
    /// Project token address to buy and burn
    pub project_token: Address,
    /// Enabled flag
    pub enabled: bool,
}

/// Buyback execution record
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BuybackRecord {
    /// Timestamp of buyback execution
    pub timestamp: u64,
    /// Amount of stablecoin/currency used for purchase
    pub purchase_amount: u128,
    /// Amount of tokens purchased
    pub tokens_purchased: u128,
    /// Price per token at time of purchase
    pub price_per_token: u128,
    /// Transaction hash/ID
    pub transaction_id: Symbol,
}

/// Data storage keys
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    BuybackConfig,
    LastBuybackTime,
    BuybackHistory(u32), // indexed by record number
    BuybackCount,
    TreasuryBalance,
    CumulativeTokensBought,
}

#[contract]
pub struct TokenBuyback;

#[contractimpl]
impl TokenBuyback {
    /// Initialize the buyback program with configuration
    pub fn init(
        env: Env,
        admin: Address,
        dex_contract: Address,
        treasury: Address,
        project_token: Address,
        revenue_percentage: u32,
        frequency: u64,
        min_buyback_amount: u128,
        max_buyback_amount: u128,
    ) {
        if env.storage().instance().has(&DataKey::BuybackConfig) {
            panic_with_error!(&env, BuybackError::AlreadyInitialized);
        }

        admin.require_auth();

        if revenue_percentage > 100 {
            panic_with_error!(&env, BuybackError::InvalidPercentage);
        }

        if frequency == 0 {
            panic_with_error!(&env, BuybackError::InvalidFrequency);
        }

        if min_buyback_amount > max_buyback_amount {
            panic_with_error!(&env, BuybackError::InvalidLimits);
        }

        let config = BuybackConfig {
            revenue_percentage,
            frequency,
            min_buyback_amount,
            max_buyback_amount,
            admin: admin.clone(),
            dex_contract,
            treasury,
            project_token,
            enabled: true,
        };

        env.storage()
            .instance()
            .set(&DataKey::BuybackConfig, &config);
        env.storage()
            .instance()
            .set(&DataKey::LastBuybackTime, &env.ledger().timestamp());
        env.storage().instance().set(&DataKey::BuybackCount, &0u32);
        env.storage()
            .instance()
            .set(&DataKey::TreasuryBalance, &0u128);
        env.storage()
            .instance()
            .set(&DataKey::CumulativeTokensBought, &0u128);

        env.events().publish(
            (Symbol::new(&env, "buyback"), Symbol::new(&env, "init")),
            (admin, revenue_percentage, frequency),
        );
    }

    /// Update buyback configuration (admin only)
    pub fn update_config(
        env: Env,
        revenue_percentage: u32,
        frequency: u64,
        min_buyback_amount: u128,
        max_buyback_amount: u128,
    ) {
        let mut config: BuybackConfig = env
            .storage()
            .instance()
            .get(&DataKey::BuybackConfig)
            .ok_or_else(|| panic_with_error!(&env, BuybackError::NotInitialized))
            .unwrap();

        config.admin.require_auth();

        if revenue_percentage > 100 {
            panic_with_error!(&env, BuybackError::InvalidPercentage);
        }

        if frequency == 0 {
            panic_with_error!(&env, BuybackError::InvalidFrequency);
        }

        if min_buyback_amount > max_buyback_amount {
            panic_with_error!(&env, BuybackError::InvalidLimits);
        }

        config.revenue_percentage = revenue_percentage;
        config.frequency = frequency;
        config.min_buyback_amount = min_buyback_amount;
        config.max_buyback_amount = max_buyback_amount;

        env.storage()
            .instance()
            .set(&DataKey::BuybackConfig, &config);

        env.events().publish(
            (
                Symbol::new(&env, "buyback"),
                Symbol::new(&env, "config_updated"),
            ),
            (
                revenue_percentage,
                frequency,
                min_buyback_amount,
                max_buyback_amount,
            ),
        );
    }

    /// Get current buyback configuration
    pub fn get_config(env: Env) -> BuybackConfig {
        env.storage()
            .instance()
            .get(&DataKey::BuybackConfig)
            .ok_or_else(|| panic_with_error!(&env, BuybackError::NotInitialized))
            .unwrap()
    }

    /// Enable or disable buyback program
    pub fn set_enabled(env: Env, enabled: bool) {
        let mut config: BuybackConfig = env
            .storage()
            .instance()
            .get(&DataKey::BuybackConfig)
            .ok_or_else(|| panic_with_error!(&env, BuybackError::NotInitialized))
            .unwrap();

        config.admin.require_auth();
        config.enabled = enabled;

        env.storage()
            .instance()
            .set(&DataKey::BuybackConfig, &config);

        env.events().publish(
            (
                Symbol::new(&env, "buyback"),
                Symbol::new(&env, "enabled_changed"),
            ),
            (enabled,),
        );
    }

    /// Deposit revenue to treasury
    pub fn deposit_revenue(env: Env, amount: u128) {
        if amount == 0 {
            panic_with_error!(&env, BuybackError::InvalidAmount);
        }

        let current_balance: u128 = env
            .storage()
            .instance()
            .get(&DataKey::TreasuryBalance)
            .unwrap_or(0);
        let new_balance = current_balance + amount;

        env.storage()
            .instance()
            .set(&DataKey::TreasuryBalance, &new_balance);

        env.events().publish(
            (
                Symbol::new(&env, "buyback"),
                Symbol::new(&env, "revenue_deposited"),
            ),
            (amount,),
        );
    }

    /// Check if buyback is due based on frequency
    pub fn is_buyback_due(env: Env) -> bool {
        let config: BuybackConfig = env
            .storage()
            .instance()
            .get(&DataKey::BuybackConfig)
            .ok_or_else(|| panic_with_error!(&env, BuybackError::NotInitialized))
            .unwrap();

        if !config.enabled {
            return false;
        }

        let last_buyback: u64 = env
            .storage()
            .instance()
            .get(&DataKey::LastBuybackTime)
            .unwrap_or(0);
        let current_time = env.ledger().timestamp();

        current_time >= last_buyback + config.frequency
    }

    /// Execute a buyback by swapping treasury funds for project tokens via DEX and permanently burning them.
    pub fn execute_buyback(env: Env, caller: Address, amount: u128) {
        let mut config: BuybackConfig = env
            .storage()
            .instance()
            .get(&DataKey::BuybackConfig)
            .ok_or_else(|| panic_with_error!(&env, BuybackError::NotInitialized))
            .unwrap();

        // Admin can trigger at any time. Cron-trigger (or public calls) can trigger only when buyback is due.
        let is_admin = caller == config.admin;
        if is_admin {
            caller.require_auth();
        } else {
            caller.require_auth();
            if !Self::is_buyback_due(env.clone()) {
                panic_with_error!(&env, BuybackError::BuybackNotDue);
            }
        }

        if amount == 0 || amount < config.min_buyback_amount || amount > config.max_buyback_amount {
            panic_with_error!(&env, BuybackError::InvalidAmount);
        }

        let treasury_balance: u128 = env
            .storage()
            .instance()
            .get(&DataKey::TreasuryBalance)
            .unwrap_or(0);

        if treasury_balance < amount {
            panic_with_error!(&env, BuybackError::InsufficientTreasury);
        }

        // Perform Swap: Swap treasury stablecoin tokens for project tokens using DEX.
        let dex_client = crate::amm_pool::ConstantProductPoolContractClient::new(&env, &config.dex_contract);
        let current_addr = env.current_contract_address();
        
        let tokens_purchased_i128 = dex_client.swap(&current_addr, &current_addr, &(amount as i128));
        let tokens_purchased = tokens_purchased_i128 as u128;

        if tokens_purchased == 0 {
            panic_with_error!(&env, BuybackError::TransactionFailed);
        }

        // Call Token Burn: Permanently burn the purchased project tokens.
        let token_client = soroban_sdk::token::Client::new(&env, &config.project_token);
        token_client.burn(&current_addr, &tokens_purchased_i128);

        // Update records
        Self::record_buyback_internal(&env, &config, amount, tokens_purchased);
    }

    /// Record a buyback transaction (admin-only manual override)
    pub fn record_buyback(
        env: Env,
        purchase_amount: u128,
        tokens_purchased: u128,
        transaction_id: Symbol,
    ) {
        let config: BuybackConfig = env
            .storage()
            .instance()
            .get(&DataKey::BuybackConfig)
            .ok_or_else(|| panic_with_error!(&env, BuybackError::NotInitialized))
            .unwrap();

        config.admin.require_auth();

        if purchase_amount == 0 || tokens_purchased == 0 {
            panic_with_error!(&env, BuybackError::InvalidAmount);
        }

        let treasury_balance: u128 = env
            .storage()
            .instance()
            .get(&DataKey::TreasuryBalance)
            .unwrap_or(0);

        if treasury_balance < purchase_amount {
            panic_with_error!(&env, BuybackError::InsufficientTreasury);
        }

        let _ = transaction_id; // Unused for internal recording
        Self::record_buyback_internal(&env, &config, purchase_amount, tokens_purchased);
    }

    fn record_buyback_internal(
        env: &Env,
        config: &BuybackConfig,
        purchase_amount: u128,
        tokens_purchased: u128,
    ) {
        // Calculate price per token (scaled by 1e9 for precision)
        let price_per_token = if tokens_purchased > 0 {
            purchase_amount.saturating_mul(1_000_000_000) / tokens_purchased
        } else {
            0
        };

        let tx_id = Symbol::new(env, "buyback_tx");
        let record = BuybackRecord {
            timestamp: env.ledger().timestamp(),
            purchase_amount,
            tokens_purchased,
            price_per_token,
            transaction_id: tx_id,
        };

        let record_count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::BuybackCount)
            .unwrap_or(0);

        env.storage()
            .instance()
            .set(&DataKey::BuybackHistory(record_count), &record);

        env.storage()
            .instance()
            .set(&DataKey::BuybackCount, &(record_count + 1));

        let treasury_balance: u128 = env
            .storage()
            .instance()
            .get(&DataKey::TreasuryBalance)
            .unwrap_or(0);
        let new_balance = treasury_balance.saturating_sub(purchase_amount);
        env.storage()
            .instance()
            .set(&DataKey::TreasuryBalance, &new_balance);

        let cumulative: u128 = env
            .storage()
            .instance()
            .get(&DataKey::CumulativeTokensBought)
            .unwrap_or(0);
        env.storage().instance().set(
            &DataKey::CumulativeTokensBought,
            &(cumulative + tokens_purchased),
        );

        env.storage()
            .instance()
            .set(&DataKey::LastBuybackTime, &env.ledger().timestamp());

        env.events().publish(
            (
                Symbol::new(env, "buyback"),
                Symbol::new(env, "buyback_executed"),
            ),
            (purchase_amount, tokens_purchased, price_per_token),
        );
    }

    /// Get buyback history record
    pub fn get_buyback_record(env: Env, index: u32) -> Option<BuybackRecord> {
        env.storage()
            .instance()
            .get(&DataKey::BuybackHistory(index))
    }

    /// Get buyback history count
    pub fn get_buyback_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::BuybackCount)
            .unwrap_or(0)
    }

    /// Get treasury balance
    pub fn get_treasury_balance(env: Env) -> u128 {
        env.storage()
            .instance()
            .get(&DataKey::TreasuryBalance)
            .unwrap_or(0)
    }

    /// Get cumulative tokens purchased
    pub fn get_cumulative_tokens_bought(env: Env) -> u128 {
        env.storage()
            .instance()
            .get(&DataKey::CumulativeTokensBought)
            .unwrap_or(0)
    }

    /// Get last buyback time
    pub fn get_last_buyback_time(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::LastBuybackTime)
            .unwrap_or(0)
    }

    /// Get buyback statistics
    pub fn get_statistics(env: Env) -> (u128, u128, u32) {
        let total_spent: u128 = {
            let count: u32 = env
                .storage()
                .instance()
                .get(&DataKey::BuybackCount)
                .unwrap_or(0);
            let mut total = 0u128;
            for i in 0..count {
                if let Some(record) = env
                    .storage()
                    .instance()
                    .get::<_, BuybackRecord>(&DataKey::BuybackHistory(i))
                {
                    total += record.purchase_amount;
                }
            }
            total
        };

        let tokens_bought: u128 = env
            .storage()
            .instance()
            .get(&DataKey::CumulativeTokensBought)
            .unwrap_or(0);

        let buyback_count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::BuybackCount)
            .unwrap_or(0);

        (total_spent, tokens_bought, buyback_count)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_buyback_init() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let dex = Address::generate(&env);
        let treasury = Address::generate(&env);
        let project_token = Address::generate(&env);

        let contract_id = env.register(TokenBuyback, ());
        env.as_contract(&contract_id, || {
            TokenBuyback::init(
                env.clone(),
                admin.clone(),
                dex,
                treasury,
                project_token,
                10,    // 10% revenue
                86400, // Daily frequency
                1000,
                10000,
            );

            let config = TokenBuyback::get_config(env.clone());
            assert_eq!(config.revenue_percentage, 10);
            assert_eq!(config.frequency, 86400);
        });
    }

    #[test]
    fn test_execute_buyback() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let dex = env.register(crate::amm_pool::ConstantProductPoolContract, ());
        let treasury = Address::generate(&env);
        
        let project_token_admin = Address::generate(&env);
        let project_token_contract = env.register_stellar_asset_contract_v2(project_token_admin.clone());
        let project_token_admin_client = soroban_sdk::token::StellarAssetClient::new(&env, &project_token_contract.address());
        
        let contract_id = env.register(TokenBuyback, ());
        let client = TokenBuybackClient::new(&env, &contract_id);
        
        // Pre-mint tokens to the buyback contract so it can execute the burn
        project_token_admin_client.mint(&contract_id, &2000);
        
        client.init(
            &admin,
            &dex,
            &treasury,
            &project_token_contract.address(),
            &10,
            &100,
            &100,
            &10000,
        );

        client.deposit_revenue(&5000);
        assert_eq!(client.get_treasury_balance(), 5000);

        client.execute_buyback(&admin, &2000);

        assert_eq!(client.get_treasury_balance(), 3000);
        assert_eq!(client.get_cumulative_tokens_bought(), 2000);
    }
}
