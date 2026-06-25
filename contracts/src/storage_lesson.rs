#![no_std]
use soroban_sdk::{contract, contractimpl, Env, Symbol};

#[contract]
pub struct StorageLessonContract;

#[contractimpl]
impl StorageLessonContract {
    /// Lesson template focusing on Instance storage in Soroban.
    /// Storage fee mechanics:
    /// Instance storage is stored along with the contract instance.
    /// It shares the same TTL as the contract instance.
    
    pub fn set(env: Env, key: Symbol, val: u32) {
        // Implement standard set function using instance keys.
        env.storage().instance().set(&key, &val);
    }

    pub fn get(env: Env, key: Symbol) -> Option<u32> {
        // Implement standard get function using instance keys.
        env.storage().instance().get(&key)
    }
}
