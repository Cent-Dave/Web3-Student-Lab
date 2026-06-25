//! Educational Soroban payment gateway contract.
//!
//! The gateway demonstrates the payment lifecycle that merchants commonly need:
//! processing a customer payment into escrow, releasing funds to a merchant,
//! refunding before settlement, and resolving disputes with an administrator.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, token, Address, BytesN,
    Env, String, Symbol,
};

/// Payment lifecycle states used by the gateway.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum PaymentStatus {
    /// Funds are held by the gateway contract and can be released, refunded, or disputed.
    Pending,
    /// Funds have been paid out to the merchant.
    Released,
    /// Funds have been returned to the payer.
    Refunded,
    /// Funds are frozen until the administrator resolves the dispute.
    Disputed,
}

/// Dispute resolution choices made by the gateway administrator.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DisputeDecision {
    /// Return escrowed funds to the payer.
    RefundPayer,
    /// Release escrowed funds to the merchant.
    ReleaseMerchant,
}

/// Complete payment record stored by payment id.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentRecord {
    /// Frontend- or merchant-generated idempotency key.
    pub payment_id: BytesN<32>,
    /// Customer who funded the payment.
    pub payer: Address,
    /// Merchant who can settle or voluntarily refund the payment.
    pub merchant: Address,
    /// Token amount held or settled in base units.
    pub amount: i128,
    /// Current lifecycle state.
    pub status: PaymentStatus,
    /// Ledger timestamp when the payment was first processed.
    pub created_at: u64,
    /// Last state-transition timestamp.
    pub updated_at: u64,
    /// Educational note such as order id, item sku, or reason for a dispute/refund.
    pub memo: String,
}

/// Storage keys for gateway configuration and payments.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum GatewayKey {
    Admin,
    Token,
    Payment(BytesN<32>),
}

/// Explicit revert reasons for classroom simulations.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum GatewayError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidAmount = 3,
    PaymentAlreadyExists = 4,
    PaymentNotFound = 5,
    InvalidState = 6,
    UnauthorizedDisputeOpener = 7,
}

#[contract]
pub struct PaymentGatewayContract;

#[contractimpl]
impl PaymentGatewayContract {
    /// Configure the gateway administrator and accepted token contract.
    pub fn init(env: Env, admin: Address, token_contract: Address) {
        if env.storage().instance().has(&GatewayKey::Admin) {
            panic_with_error!(&env, GatewayError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&GatewayKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&GatewayKey::Token, &token_contract);
    }

    /// Process a customer payment into contract escrow.
    ///
    /// `payment_id` acts as an idempotency key: attempting to reuse it reverts
    /// instead of charging the payer twice. Funds are transferred from `payer`
    /// to `env.current_contract_address()` and stay there until release/refund.
    pub fn process_payment(
        env: Env,
        payment_id: BytesN<32>,
        payer: Address,
        merchant: Address,
        amount: i128,
        memo: String,
    ) -> PaymentRecord {
        Self::require_initialized(&env);
        if amount <= 0 {
            panic_with_error!(&env, GatewayError::InvalidAmount);
        }

        let key = GatewayKey::Payment(payment_id.clone());
        if env.storage().persistent().has(&key) {
            panic_with_error!(&env, GatewayError::PaymentAlreadyExists);
        }

        payer.require_auth();
        let token_address = Self::token_address(&env);
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&payer, &env.current_contract_address(), &amount);

        let now = env.ledger().timestamp();
        let record = PaymentRecord {
            payment_id: payment_id.clone(),
            payer: payer.clone(),
            merchant: merchant.clone(),
            amount,
            status: PaymentStatus::Pending,
            created_at: now,
            updated_at: now,
            memo,
        };
        env.storage().persistent().set(&key, &record);
        env.events().publish(
            (Symbol::new(&env, "payment_processed"), merchant),
            (payment_id, payer, amount),
        );
        record
    }

    /// Release an undisputed escrow payment to the merchant.
    pub fn release_payment(env: Env, payment_id: BytesN<32>) -> PaymentRecord {
        let mut record = Self::load_payment(&env, payment_id.clone());
        if record.status != PaymentStatus::Pending {
            panic_with_error!(&env, GatewayError::InvalidState);
        }

        record.merchant.require_auth();
        Self::transfer_from_escrow(&env, &record.merchant, record.amount);
        record.status = PaymentStatus::Released;
        record.updated_at = env.ledger().timestamp();
        Self::store_payment(&env, &record);
        env.events().publish(
            (
                Symbol::new(&env, "payment_released"),
                record.merchant.clone(),
            ),
            (payment_id, record.amount),
        );
        record
    }

    /// Let a merchant voluntarily refund a pending payment before settlement.
    pub fn refund_payment(env: Env, payment_id: BytesN<32>, reason: String) -> PaymentRecord {
        let mut record = Self::load_payment(&env, payment_id.clone());
        if record.status != PaymentStatus::Pending {
            panic_with_error!(&env, GatewayError::InvalidState);
        }

        record.merchant.require_auth();
        Self::transfer_from_escrow(&env, &record.payer, record.amount);
        record.status = PaymentStatus::Refunded;
        record.updated_at = env.ledger().timestamp();
        record.memo = reason;
        Self::store_payment(&env, &record);
        env.events().publish(
            (Symbol::new(&env, "payment_refunded"), record.payer.clone()),
            (payment_id, record.amount),
        );
        record
    }

    /// Open a dispute while funds are still pending.
    ///
    /// Either the payer or merchant may open a dispute, but the opener must
    /// authorize the call. The funds remain in escrow until `resolve_dispute`.
    pub fn open_dispute(
        env: Env,
        payment_id: BytesN<32>,
        opened_by: Address,
        reason: String,
    ) -> PaymentRecord {
        let mut record = Self::load_payment(&env, payment_id.clone());
        if record.status != PaymentStatus::Pending {
            panic_with_error!(&env, GatewayError::InvalidState);
        }
        if opened_by != record.payer && opened_by != record.merchant {
            panic_with_error!(&env, GatewayError::UnauthorizedDisputeOpener);
        }

        opened_by.require_auth();
        record.status = PaymentStatus::Disputed;
        record.updated_at = env.ledger().timestamp();
        record.memo = reason;
        Self::store_payment(&env, &record);
        env.events().publish(
            (Symbol::new(&env, "payment_disputed"), opened_by),
            (payment_id, record.amount),
        );
        record
    }

    /// Resolve a disputed payment as the configured administrator.
    pub fn resolve_dispute(
        env: Env,
        payment_id: BytesN<32>,
        decision: DisputeDecision,
        note: String,
    ) -> PaymentRecord {
        let admin = Self::admin(&env);
        admin.require_auth();

        let mut record = Self::load_payment(&env, payment_id.clone());
        if record.status != PaymentStatus::Disputed {
            panic_with_error!(&env, GatewayError::InvalidState);
        }

        match decision {
            DisputeDecision::RefundPayer => {
                Self::transfer_from_escrow(&env, &record.payer, record.amount);
                record.status = PaymentStatus::Refunded;
            }
            DisputeDecision::ReleaseMerchant => {
                Self::transfer_from_escrow(&env, &record.merchant, record.amount);
                record.status = PaymentStatus::Released;
            }
        }
        record.updated_at = env.ledger().timestamp();
        record.memo = note;
        Self::store_payment(&env, &record);
        env.events().publish(
            (Symbol::new(&env, "dispute_resolved"), admin),
            (payment_id, record.amount),
        );
        record
    }

    /// Return the current record for a payment id.
    pub fn get_payment(env: Env, payment_id: BytesN<32>) -> Option<PaymentRecord> {
        env.storage()
            .persistent()
            .get(&GatewayKey::Payment(payment_id))
    }

    /// Beginner-friendly helper for checking whether funds have reached merchant.
    pub fn is_released(env: Env, payment_id: BytesN<32>) -> bool {
        Self::get_payment(env, payment_id)
            .map(|record| record.status == PaymentStatus::Released)
            .unwrap_or(false)
    }

    fn require_initialized(env: &Env) {
        if !env.storage().instance().has(&GatewayKey::Admin) {
            panic_with_error!(env, GatewayError::NotInitialized);
        }
    }

    fn admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&GatewayKey::Admin)
            .unwrap_or_else(|| panic_with_error!(env, GatewayError::NotInitialized))
    }

    fn token_address(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&GatewayKey::Token)
            .unwrap_or_else(|| panic_with_error!(env, GatewayError::NotInitialized))
    }

    fn load_payment(env: &Env, payment_id: BytesN<32>) -> PaymentRecord {
        env.storage()
            .persistent()
            .get(&GatewayKey::Payment(payment_id))
            .unwrap_or_else(|| panic_with_error!(env, GatewayError::PaymentNotFound))
    }

    fn store_payment(env: &Env, record: &PaymentRecord) {
        env.storage()
            .persistent()
            .set(&GatewayKey::Payment(record.payment_id.clone()), record);
    }

    fn transfer_from_escrow(env: &Env, to: &Address, amount: i128) {
        let token_address = Self::token_address(env);
        let token_client = token::Client::new(env, &token_address);
        token_client.transfer(&env.current_contract_address(), to, &amount);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        token::{Client as TokenClient, StellarAssetClient},
        Address, BytesN, Env, String,
    };

    struct Fixture {
        env: Env,
        admin: Address,
        payer: Address,
        merchant: Address,
        token: Address,
        client: PaymentGatewayContractClient<'static>,
    }

    fn payment_id(env: &Env, seed: u8) -> BytesN<32> {
        BytesN::from_array(env, &[seed; 32])
    }

    fn setup() -> Fixture {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().with_mut(|ledger| {
            ledger.timestamp = 1_772_601_000;
            ledger.sequence_number = 100;
        });

        let asset_admin = Address::generate(&env);
        let asset = env.register_stellar_asset_contract_v2(asset_admin.clone());
        let token = asset.address();
        let admin = Address::generate(&env);
        let payer = Address::generate(&env);
        let merchant = Address::generate(&env);
        StellarAssetClient::new(&env, &token).mint(&payer, &10_000);

        let contract_id = env.register(PaymentGatewayContract, ());
        let client = PaymentGatewayContractClient::new(&env, &contract_id);
        client.init(&admin, &token);

        Fixture {
            env,
            admin,
            payer,
            merchant,
            token,
            client,
        }
    }

    #[test]
    fn processes_payment_into_gateway_escrow() {
        let f = setup();
        let id = payment_id(&f.env, 1);
        let token = TokenClient::new(&f.env, &f.token);

        let record = f.client.process_payment(
            &id,
            &f.payer,
            &f.merchant,
            &2_500,
            &String::from_str(&f.env, "order-100"),
        );

        assert_eq!(record.status, PaymentStatus::Pending);
        assert_eq!(record.created_at, 1_772_601_000);
        assert_eq!(token.balance(&f.client.address), 2_500);
        assert_eq!(token.balance(&f.payer), 7_500);
    }

    #[test]
    fn merchant_releases_pending_payment() {
        let f = setup();
        let id = payment_id(&f.env, 2);
        let token = TokenClient::new(&f.env, &f.token);
        f.client.process_payment(
            &id,
            &f.payer,
            &f.merchant,
            &900,
            &String::from_str(&f.env, "order"),
        );

        let record = f.client.release_payment(&id);

        assert_eq!(record.status, PaymentStatus::Released);
        assert!(f.client.is_released(&id));
        assert_eq!(token.balance(&f.merchant), 900);
        assert_eq!(token.balance(&f.client.address), 0);
    }

    #[test]
    fn merchant_can_refund_pending_payment() {
        let f = setup();
        let id = payment_id(&f.env, 3);
        let token = TokenClient::new(&f.env, &f.token);
        f.client.process_payment(
            &id,
            &f.payer,
            &f.merchant,
            &1_200,
            &String::from_str(&f.env, "order"),
        );

        let record = f
            .client
            .refund_payment(&id, &String::from_str(&f.env, "out-of-stock"));

        assert_eq!(record.status, PaymentStatus::Refunded);
        assert_eq!(token.balance(&f.payer), 10_000);
        assert_eq!(token.balance(&f.client.address), 0);
    }

    #[test]
    fn payer_opens_dispute_and_admin_refunds() {
        let f = setup();
        let id = payment_id(&f.env, 4);
        let token = TokenClient::new(&f.env, &f.token);
        f.client.process_payment(
            &id,
            &f.payer,
            &f.merchant,
            &700,
            &String::from_str(&f.env, "order"),
        );

        let disputed =
            f.client
                .open_dispute(&id, &f.payer, &String::from_str(&f.env, "not delivered"));
        assert_eq!(disputed.status, PaymentStatus::Disputed);

        let resolved = f.client.resolve_dispute(
            &id,
            &DisputeDecision::RefundPayer,
            &String::from_str(&f.env, "student wins"),
        );

        assert_eq!(resolved.status, PaymentStatus::Refunded);
        assert_eq!(token.balance(&f.payer), 10_000);
        assert_eq!(token.balance(&f.merchant), 0);
    }

    #[test]
    fn merchant_opens_dispute_and_admin_releases() {
        let f = setup();
        let id = payment_id(&f.env, 5);
        let token = TokenClient::new(&f.env, &f.token);
        f.client.process_payment(
            &id,
            &f.payer,
            &f.merchant,
            &600,
            &String::from_str(&f.env, "order"),
        );
        f.client.open_dispute(
            &id,
            &f.merchant,
            &String::from_str(&f.env, "chargeback risk"),
        );

        let resolved = f.client.resolve_dispute(
            &id,
            &DisputeDecision::ReleaseMerchant,
            &String::from_str(&f.env, "proof supplied"),
        );

        assert_eq!(resolved.status, PaymentStatus::Released);
        assert_eq!(token.balance(&f.merchant), 600);
    }

    #[test]
    fn get_payment_returns_none_for_unknown_id() {
        let f = setup();
        assert_eq!(f.client.get_payment(&payment_id(&f.env, 99)), None);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #1)")]
    fn init_can_only_run_once() {
        let f = setup();
        f.client.init(&f.admin, &f.token);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #3)")]
    fn process_rejects_non_positive_amount() {
        let f = setup();
        f.client.process_payment(
            &payment_id(&f.env, 6),
            &f.payer,
            &f.merchant,
            &0,
            &String::from_str(&f.env, "bad"),
        );
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #4)")]
    fn duplicate_payment_id_reverts() {
        let f = setup();
        let id = payment_id(&f.env, 7);
        f.client.process_payment(
            &id,
            &f.payer,
            &f.merchant,
            &100,
            &String::from_str(&f.env, "first"),
        );
        f.client.process_payment(
            &id,
            &f.payer,
            &f.merchant,
            &100,
            &String::from_str(&f.env, "second"),
        );
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #6)")]
    fn cannot_release_after_refund() {
        let f = setup();
        let id = payment_id(&f.env, 8);
        f.client.process_payment(
            &id,
            &f.payer,
            &f.merchant,
            &100,
            &String::from_str(&f.env, "order"),
        );
        f.client
            .refund_payment(&id, &String::from_str(&f.env, "refunded"));
        f.client.release_payment(&id);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #7)")]
    fn only_payer_or_merchant_can_open_dispute() {
        let f = setup();
        let stranger = Address::generate(&f.env);
        let id = payment_id(&f.env, 9);
        f.client.process_payment(
            &id,
            &f.payer,
            &f.merchant,
            &100,
            &String::from_str(&f.env, "order"),
        );
        f.client
            .open_dispute(&id, &stranger, &String::from_str(&f.env, "invalid"));
    }
}
