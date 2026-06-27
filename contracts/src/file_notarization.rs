//! Educational Soroban file notarization contract.
//!
//! A notary does not store a document on-chain. Instead, users hash a document
//! off-chain (for example with SHA-256) and register only that 32-byte digest.
//! Anyone can later hash the same document and call `verify` to prove the file
//! existed at or before the stored ledger timestamp without revealing contents.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, BytesN, Env,
    String, Symbol, Vec,
};

/// Immutable proof-of-existence data captured when a hash is registered.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NotarizationRecord {
    /// SHA-256 (or equivalent 32-byte) document digest supplied by the user.
    pub hash: BytesN<32>,
    /// Account that registered the hash and must authorize registration.
    pub owner: Address,
    /// Ledger close timestamp in seconds. This is the educational notarization
    /// time anchor used by verifiers.
    pub timestamp: u64,
    /// Ledger sequence captured with the timestamp for deterministic ordering.
    pub ledger_sequence: u32,
    /// Short user-facing note such as a filename, version, or classroom label.
    /// The real document should stay off-chain to preserve privacy and save gas.
    pub metadata: String,
}

/// Storage layout for the notarization registry.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum NotarizationKey {
    /// Global record lookup by document hash.
    Record(BytesN<32>),
    /// Per-owner list of hashes to power playground history screens.
    OwnerHashes(Address),
}

/// Revert reasons intentionally use stable numeric discriminants so tests and
/// learners can identify exactly why a transaction failed.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum NotarizationError {
    /// A hash can be notarized only once because the first timestamp is the
    /// legally meaningful proof-of-existence anchor in this lab.
    HashAlreadyRegistered = 1,
    /// Bulk calls must provide one metadata entry per hash to avoid accidental
    /// mismatches in classroom exercises.
    MetadataLengthMismatch = 2,
    /// Empty batches waste ledger resources and usually indicate a UI mistake.
    EmptyBatch = 3,
}

#[contract]
pub struct FileNotarizationContract;

#[contractimpl]
impl FileNotarizationContract {
    /// Register a 32-byte file hash with the current ledger timestamp.
    ///
    /// The caller supplies `owner` explicitly so tests and frontends can teach
    /// authorization: `owner.require_auth()` ensures only that address can create
    /// records in its own name. If the hash already exists the contract reverts,
    /// preserving the original timestamp and owner.
    pub fn register_hash(
        env: Env,
        owner: Address,
        hash: BytesN<32>,
        metadata: String,
    ) -> NotarizationRecord {
        owner.require_auth();
        Self::store_new_record(&env, owner, hash, metadata)
    }

    /// Register several hashes in one transaction.
    ///
    /// This helper mirrors the single-hash path and still emits one event per
    /// file. It is useful for showing how notarization can batch classroom
    /// submissions while keeping each file independently verifiable.
    pub fn register_batch(
        env: Env,
        owner: Address,
        hashes: Vec<BytesN<32>>,
        metadata: Vec<String>,
    ) -> Vec<NotarizationRecord> {
        if hashes.is_empty() {
            panic_with_error!(&env, NotarizationError::EmptyBatch);
        }
        if hashes.len() != metadata.len() {
            panic_with_error!(&env, NotarizationError::MetadataLengthMismatch);
        }

        owner.require_auth();
        let mut records = Vec::new(&env);
        for index in 0..hashes.len() {
            let record = Self::store_new_record(
                &env,
                owner.clone(),
                hashes.get(index).unwrap(),
                metadata.get(index).unwrap(),
            );
            records.push_back(record);
        }
        records
    }

    fn store_new_record(
        env: &Env,
        owner: Address,
        hash: BytesN<32>,
        metadata: String,
    ) -> NotarizationRecord {
        let record_key = NotarizationKey::Record(hash.clone());
        if env.storage().persistent().has(&record_key) {
            panic_with_error!(env, NotarizationError::HashAlreadyRegistered);
        }

        let record = NotarizationRecord {
            hash: hash.clone(),
            owner: owner.clone(),
            timestamp: env.ledger().timestamp(),
            ledger_sequence: env.ledger().sequence(),
            metadata,
        };

        env.storage().persistent().set(&record_key, &record);

        let history_key = NotarizationKey::OwnerHashes(owner.clone());
        let mut hashes: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&history_key)
            .unwrap_or_else(|| Vec::new(env));
        hashes.push_back(hash.clone());
        env.storage().persistent().set(&history_key, &hashes);

        env.events().publish(
            (Symbol::new(env, "file_notarized"), owner.clone()),
            (hash, record.timestamp, record.ledger_sequence),
        );

        record
    }

    /// Return the notarization record for `hash`, if it exists.
    pub fn verify(env: Env, hash: BytesN<32>) -> Option<NotarizationRecord> {
        env.storage()
            .persistent()
            .get(&NotarizationKey::Record(hash))
    }

    /// Convenience boolean for playground simulations and beginner exercises.
    pub fn is_registered(env: Env, hash: BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .has(&NotarizationKey::Record(hash))
    }

    /// Return all records created by `owner` in registration order.
    pub fn history_for_owner(env: Env, owner: Address) -> Vec<NotarizationRecord> {
        let hashes: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&NotarizationKey::OwnerHashes(owner))
            .unwrap_or_else(|| Vec::new(&env));

        let mut records = Vec::new(&env);
        for hash in hashes.iter() {
            if let Some(record) = Self::verify(env.clone(), hash) {
                records.push_back(record);
            }
        }
        records
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        vec, BytesN, Env, String,
    };

    fn hash(env: &Env, seed: u8) -> BytesN<32> {
        BytesN::from_array(env, &[seed; 32])
    }

    fn setup() -> (Env, Address, FileNotarizationContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().with_mut(|ledger| {
            ledger.timestamp = 1_772_600_400;
            ledger.sequence_number = 42;
        });
        let owner = Address::generate(&env);
        let contract_id = env.register(FileNotarizationContract, ());
        let client = FileNotarizationContractClient::new(&env, &contract_id);
        (env, owner, client)
    }

    #[test]
    fn registers_hash_with_timestamp_and_metadata() {
        let (env, owner, client) = setup();
        let digest = hash(&env, 7);
        let note = String::from_str(&env, "final-report.pdf");

        let record = client.register_hash(&owner, &digest, &note);

        assert_eq!(record.hash, digest);
        assert_eq!(record.owner, owner);
        assert_eq!(record.timestamp, 1_772_600_400);
        assert_eq!(record.ledger_sequence, 42);
        assert_eq!(record.metadata, note);
        assert!(client.is_registered(&digest));
    }

    #[test]
    fn verify_returns_record_and_missing_hash_returns_none() {
        let (env, owner, client) = setup();
        let digest = hash(&env, 11);
        let missing = hash(&env, 12);

        let created = client.register_hash(&owner, &digest, &String::from_str(&env, "lab"));

        assert_eq!(client.verify(&digest), Some(created));
        assert_eq!(client.verify(&missing), None);
    }

    #[test]
    fn owner_history_preserves_registration_order() {
        let (env, owner, client) = setup();
        let first = hash(&env, 1);
        let second = hash(&env, 2);

        let first_record = client.register_hash(&owner, &first, &String::from_str(&env, "a"));
        let second_record = client.register_hash(&owner, &second, &String::from_str(&env, "b"));

        let history = client.history_for_owner(&owner);
        assert_eq!(history.len(), 2);
        assert_eq!(history.get(0).unwrap(), first_record);
        assert_eq!(history.get(1).unwrap(), second_record);
    }

    #[test]
    fn batch_registration_creates_independent_records() {
        let (env, owner, client) = setup();
        let hashes = vec![&env, hash(&env, 21), hash(&env, 22)];
        let metadata = vec![
            &env,
            String::from_str(&env, "chapter-1"),
            String::from_str(&env, "chapter-2"),
        ];

        let records = client.register_batch(&owner, &hashes, &metadata);

        assert_eq!(records.len(), 2);
        assert!(client.is_registered(&hashes.get(0).unwrap()));
        assert!(client.is_registered(&hashes.get(1).unwrap()));
        assert_eq!(client.history_for_owner(&owner).len(), 2);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #1)")]
    fn duplicate_hash_reverts_to_keep_first_timestamp_immutable() {
        let (env, owner, client) = setup();
        let digest = hash(&env, 5);

        client.register_hash(&owner, &digest, &String::from_str(&env, "original"));
        client.register_hash(&owner, &digest, &String::from_str(&env, "duplicate"));
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #2)")]
    fn batch_metadata_length_must_match_hashes() {
        let (env, owner, client) = setup();
        let hashes = vec![&env, hash(&env, 31), hash(&env, 32)];
        let metadata = vec![&env, String::from_str(&env, "only-one")];

        client.register_batch(&owner, &hashes, &metadata);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #3)")]
    fn empty_batch_reverts() {
        let (env, owner, client) = setup();
        client.register_batch(&owner, &Vec::new(&env), &Vec::new(&env));
    }
}
