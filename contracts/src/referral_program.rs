use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Referrer(Address),
    ReferralCount(Address),
    Rewarded(Address, Address),
}

#[contract]
pub struct ReferralProgramContract;

#[contractimpl]
impl ReferralProgramContract {
    /// Register a referral relationship. Panics on self-referral or duplicate.
    pub fn register_referral(env: Env, referrer: Address, referee: Address) {
        if referrer == referee {
            panic!("self-referral not allowed");
        }
        let key = DataKey::Referrer(referee.clone());
        if env.storage().instance().has(&key) {
            panic!("referee already has a referrer");
        }
        env.storage().instance().set(&key, &referrer.clone());

        let count_key = DataKey::ReferralCount(referrer.clone());
        let count: u32 = env.storage().instance().get(&count_key).unwrap_or(0);
        env.storage().instance().set(&count_key, &(count + 1));
    }

    /// Returns the number of successful referrals made by `referrer`.
    pub fn get_referral_count(env: Env, referrer: Address) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::ReferralCount(referrer))
            .unwrap_or(0)
    }

    /// Returns the referrer of `referee`, if any.
    pub fn get_referrer(env: Env, referee: Address) -> Option<Address> {
        env.storage()
            .instance()
            .get(&DataKey::Referrer(referee))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env};

    fn setup() -> (Env, ReferralProgramContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(ReferralProgramContract, ());
        let client = ReferralProgramContractClient::new(&env, &id);
        (env, client)
    }

    #[test]
    fn register_referral_stores_data() {
        let (env, client) = setup();
        let referrer = Address::generate(&env);
        let referee = Address::generate(&env);

        client.register_referral(&referrer, &referee);

        assert_eq!(client.get_referrer(&referee), Some(referrer));
    }

    #[test]
    fn get_referral_count_increments() {
        let (env, client) = setup();
        let referrer = Address::generate(&env);
        let referee1 = Address::generate(&env);
        let referee2 = Address::generate(&env);

        assert_eq!(client.get_referral_count(&referrer), 0);
        client.register_referral(&referrer, &referee1);
        assert_eq!(client.get_referral_count(&referrer), 1);
        client.register_referral(&referrer, &referee2);
        assert_eq!(client.get_referral_count(&referrer), 2);
    }

    #[test]
    #[should_panic]
    fn self_referral_panics() {
        let (env, client) = setup();
        let user = Address::generate(&env);
        client.register_referral(&user, &user);
    }

    #[test]
    #[should_panic]
    fn duplicate_referral_panics() {
        let (env, client) = setup();
        let referrer = Address::generate(&env);
        let referee = Address::generate(&env);
        client.register_referral(&referrer, &referee);
        client.register_referral(&referrer, &referee);
    }
}
