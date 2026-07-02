//! Multi-hop token swap router.
//!
//! Routes a token swap through an ordered sequence of AMM pools in a single
//! atomic transaction.  Every hop calls the pool contract's `swap` function,
//! which must satisfy the interface below.  If any hop reverts the entire
//! transaction is rolled back automatically by the Soroban runtime.
//!
//! ## Pool interface assumption
//! Each pool contract must expose:
//! ```text
//! fn swap(env, token_in, token_out, amount_in, min_amount_out) -> i128
//! ```
//! This matches the minimal AMM interface that Soroban-based DEX pools
//! (e.g. Soroswap) typically implement.

#![allow(dead_code)]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, token, Address, Env,
    IntoVal, Symbol, Val, Vec,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// A single hop in the route: which pool to use and which token to swap in/out.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SwapHop {
    /// Address of the AMM pool contract.
    pub pool: Address,
    /// Token being sent into this hop.
    pub token_in: Address,
    /// Token being received from this hop.
    pub token_out: Address,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum RouterError {
    /// Route must contain at least one hop.
    EmptyRoute = 1,
    /// Route exceeds the maximum allowed hops.
    RouteTooLong = 2,
    /// Output of a hop was zero (pool rejected the swap).
    ZeroOutput = 3,
    /// Final output is below the caller's minimum acceptable amount.
    SlippageExceeded = 4,
    /// Consecutive hops must chain: hop[i].token_out == hop[i+1].token_in.
    InvalidRoute = 5,
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Maximum number of hops allowed per route (keeps compute budget bounded).
const MAX_HOPS: u32 = 5;

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct SwapRouterContract;

#[contractimpl]
impl SwapRouterContract {
    /// Execute a multi-hop swap atomically.
    ///
    /// # Arguments
    /// * `caller`       – Address authorising the swap (funds debited from here on hop 0).
    /// * `route`        – Ordered list of [`SwapHop`]s.
    /// * `amount_in`    – Amount of `route[0].token_in` to spend.
    /// * `min_amount_out` – Minimum acceptable output on the last hop (slippage guard).
    ///
    /// # Returns
    /// The actual output amount of `route[last].token_out` received by `caller`.
    ///
    /// # Atomicity
    /// Soroban transactions are atomic: any panic in any hop reverts all
    /// storage / token transfers that occurred in the same invocation.
    pub fn swap(
        env: Env,
        caller: Address,
        route: Vec<SwapHop>,
        amount_in: i128,
        min_amount_out: i128,
    ) -> i128 {
        caller.require_auth();

        // --- Validate route ---
        let hop_count = route.len();
        if hop_count == 0 {
            panic_with_error!(&env, RouterError::EmptyRoute);
        }
        if hop_count > MAX_HOPS {
            panic_with_error!(&env, RouterError::RouteTooLong);
        }

        // Verify token chain: each hop's output must be the next hop's input.
        for i in 0..(hop_count - 1) {
            let current = route.get(i).unwrap();
            let next = route.get(i + 1).unwrap();
            if current.token_out != next.token_in {
                panic_with_error!(&env, RouterError::InvalidRoute);
            }
        }

        // --- Execute hops ---
        let mut current_amount = amount_in;

        for i in 0..hop_count {
            let hop = route.get(i).unwrap();
            let sender = if i == 0 {
                caller.clone()
            } else {
                env.current_contract_address()
            };

            // Transfer token_in from sender → pool.
            token::Client::new(&env, &hop.token_in).transfer(&sender, &hop.pool, &current_amount);

            // Call the pool's swap function; it must return the output amount.
            let mut args: Vec<Val> = Vec::new(&env);
            args.push_back(hop.token_in.into_val(&env));
            args.push_back(hop.token_out.into_val(&env));
            args.push_back(current_amount.into_val(&env));
            args.push_back(0_i128.into_val(&env)); // per-hop min_out; slippage checked below
            let out: i128 = env.invoke_contract(&hop.pool, &Symbol::new(&env, "swap"), args);

            if out <= 0 {
                panic_with_error!(&env, RouterError::ZeroOutput);
            }

            current_amount = out;
        }

        // --- Slippage check ---
        if current_amount < min_amount_out {
            panic_with_error!(&env, RouterError::SlippageExceeded);
        }

        // Transfer final output from this contract → caller.
        let last_hop = route.get(hop_count - 1).unwrap();
        token::Client::new(&env, &last_hop.token_out).transfer(
            &env.current_contract_address(),
            &caller,
            &current_amount,
        );

        // Emit event for off-chain indexers.
        env.events().publish(
            (Symbol::new(&env, "swap_executed"),),
            (caller, amount_in, current_amount, hop_count),
        );

        current_amount
    }

    /// Simulate a multi-hop swap and return the expected output without executing.
    ///
    /// Calls each pool's `get_amount_out(token_in, token_out, amount_in) -> i128`
    /// view function. No transfers occur.
    pub fn get_expected_output(env: Env, route: Vec<SwapHop>, amount_in: i128) -> i128 {
        let hop_count = route.len();
        if hop_count == 0 {
            panic_with_error!(&env, RouterError::EmptyRoute);
        }
        if hop_count > MAX_HOPS {
            panic_with_error!(&env, RouterError::RouteTooLong);
        }

        let mut current_amount = amount_in;

        for i in 0..hop_count {
            let hop = route.get(i).unwrap();
            let mut args: Vec<Val> = Vec::new(&env);
            args.push_back(hop.token_in.into_val(&env));
            args.push_back(hop.token_out.into_val(&env));
            args.push_back(current_amount.into_val(&env));
            let out: i128 =
                env.invoke_contract(&hop.pool, &Symbol::new(&env, "get_amount_out"), args);
            if out <= 0 {
                panic_with_error!(&env, RouterError::ZeroOutput);
            }
            current_amount = out;
        }

        current_amount
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        contract, contractimpl,
        testutils::Address as _,
        token::{Client as TokenClient, StellarAssetClient},
        vec, Address, Env,
    };

    // -----------------------------------------------------------------------
    // Minimal mock pool
    // -----------------------------------------------------------------------

    /// A trivial AMM stub: swap returns 90% of amount_in (10% fee).
    /// get_amount_out returns the same ratio without state changes.
    #[contract]
    pub struct MockPool;

    #[contractimpl]
    impl MockPool {
        pub fn swap(
            _env: Env,
            _token_in: Address,
            _token_out: Address,
            amount_in: i128,
            _min_out: i128,
        ) -> i128 {
            amount_in * 9 / 10
        }

        pub fn get_amount_out(
            _env: Env,
            _token_in: Address,
            _token_out: Address,
            amount_in: i128,
        ) -> i128 {
            amount_in * 9 / 10
        }
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    fn create_token(env: &Env, admin: &Address) -> Address {
        let addr = env
            .register_stellar_asset_contract_v2(admin.clone())
            .address();
        addr
    }

    fn mint(env: &Env, admin: &Address, token: &Address, to: &Address, amount: i128) {
        StellarAssetClient::new(env, token).mint(to, &amount);
        let _ = admin;
    }

    // -----------------------------------------------------------------------
    // Tests
    // -----------------------------------------------------------------------

    #[test]
    fn single_hop_swap_succeeds() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let caller = Address::generate(&env);

        let token_a = create_token(&env, &admin);
        let token_b = create_token(&env, &admin);

        let pool_id = env.register(MockPool, ());
        let router_id = env.register(SwapRouterContract, ());

        // Fund caller with token_a
        mint(&env, &admin, &token_a, &caller, 1000);
        // Fund router (receives token_b from pool in reality; mock just needs balance)
        mint(&env, &admin, &token_b, &router_id, 1000);

        let route = vec![
            &env,
            SwapHop {
                pool: pool_id.clone(),
                token_in: token_a.clone(),
                token_out: token_b.clone(),
            },
        ];

        let client = SwapRouterContractClient::new(&env, &router_id);
        let out = client.swap(&caller, &route, &1000, &800);

        // 90% of 1000 = 900
        assert_eq!(out, 900);
        assert_eq!(TokenClient::new(&env, &token_b).balance(&caller), 900);
    }

    #[test]
    fn two_hop_swap_chains_correctly() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let caller = Address::generate(&env);

        let token_a = create_token(&env, &admin);
        let token_b = create_token(&env, &admin);
        let token_c = create_token(&env, &admin);

        let pool_ab = env.register(MockPool, ());
        let pool_bc = env.register(MockPool, ());
        let router_id = env.register(SwapRouterContract, ());

        mint(&env, &admin, &token_a, &caller, 1000);
        // Router needs token_b for the intermediate transfer and token_c for final output
        mint(&env, &admin, &token_b, &router_id, 1000);
        mint(&env, &admin, &token_c, &router_id, 1000);

        let route = vec![
            &env,
            SwapHop {
                pool: pool_ab.clone(),
                token_in: token_a.clone(),
                token_out: token_b.clone(),
            },
            SwapHop {
                pool: pool_bc.clone(),
                token_in: token_b.clone(),
                token_out: token_c.clone(),
            },
        ];

        let client = SwapRouterContractClient::new(&env, &router_id);
        // 1000 -> 900 (hop1) -> 810 (hop2)
        let out = client.swap(&caller, &route, &1000, &800);

        assert_eq!(out, 810);
        assert_eq!(TokenClient::new(&env, &token_c).balance(&caller), 810);
    }

    #[test]
    #[should_panic]
    fn slippage_guard_reverts_swap() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let caller = Address::generate(&env);

        let token_a = create_token(&env, &admin);
        let token_b = create_token(&env, &admin);

        let pool_id = env.register(MockPool, ());
        let router_id = env.register(SwapRouterContract, ());

        mint(&env, &admin, &token_a, &caller, 1000);
        mint(&env, &admin, &token_b, &router_id, 1000);

        let route = vec![
            &env,
            SwapHop {
                pool: pool_id,
                token_in: token_a,
                token_out: token_b,
            },
        ];

        let client = SwapRouterContractClient::new(&env, &router_id);
        // Require 999 out but pool only gives 900 → SlippageExceeded
        client.swap(&caller, &route, &1000, &999);
    }

    #[test]
    #[should_panic]
    fn empty_route_panics() {
        let env = Env::default();
        env.mock_all_auths();

        let caller = Address::generate(&env);
        let router_id = env.register(SwapRouterContract, ());
        let client = SwapRouterContractClient::new(&env, &router_id);

        client.swap(&caller, &vec![&env], &1000, &1);
    }

    #[test]
    #[should_panic]
    fn mismatched_token_chain_panics() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let caller = Address::generate(&env);

        let token_a = create_token(&env, &admin);
        let token_b = create_token(&env, &admin);
        let token_c = create_token(&env, &admin);
        let token_x = create_token(&env, &admin); // not token_b — breaks the chain

        let pool1 = env.register(MockPool, ());
        let pool2 = env.register(MockPool, ());
        let router_id = env.register(SwapRouterContract, ());

        mint(&env, &admin, &token_a, &caller, 1000);

        let route = vec![
            &env,
            SwapHop {
                pool: pool1,
                token_in: token_a,
                token_out: token_b, // hop0 outputs token_b
            },
            SwapHop {
                pool: pool2,
                token_in: token_x, // hop1 expects token_x ≠ token_b → InvalidRoute
                token_out: token_c,
            },
        ];

        let client = SwapRouterContractClient::new(&env, &router_id);
        client.swap(&caller, &route, &1000, &1);
    }

    #[test]
    fn get_expected_output_matches_swap() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let token_a = create_token(&env, &admin);
        let token_b = create_token(&env, &admin);

        let pool_id = env.register(MockPool, ());
        let router_id = env.register(SwapRouterContract, ());

        let route = vec![
            &env,
            SwapHop {
                pool: pool_id,
                token_in: token_a,
                token_out: token_b,
            },
        ];

        let client = SwapRouterContractClient::new(&env, &router_id);
        let expected = client.get_expected_output(&route, &1000);

        assert_eq!(expected, 900);
    }
}
