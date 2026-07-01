use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, BytesN, Symbol};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Cache(Symbol),
    Admin,
}

#[contract]
pub struct PlaygroundCacheContract;

#[contractimpl]
impl PlaygroundCacheContract {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn set_cache(env: Env, admin: Address, key: Symbol, value: BytesN<32>) {
        let config_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap_or_else(|| panic!("not initialized"));
        if admin != config_admin {
            panic!("not admin");
        }
        admin.require_auth();
        env.storage().persistent().set(&DataKey::Cache(key), &value);
    }

    pub fn get_cache(env: Env, key: Symbol) -> BytesN<32> {
        env.storage().persistent().get(&DataKey::Cache(key)).unwrap_or_else(|| panic!("not found"))
    }
}

#[cfg(test)]
mod test {
    extern crate std;
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env, BytesN, Symbol};

    #[test]
    fn test_caching_layer() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register_contract(None, PlaygroundCacheContract);
        let client = PlaygroundCacheContractClient::new(&env, &contract_id);

        client.initialize(&admin);

        let key = Symbol::new(&env, "test_key");
        let value = BytesN::from_array(&env, &[1u8; 32]);

        client.set_cache(&admin, &key, &value);
        let fetched = client.get_cache(&key);
        assert_eq!(fetched, value);
    }
}
