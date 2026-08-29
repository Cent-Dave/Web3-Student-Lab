//! # Certificate Soulbound NFT Contract
//!
//! Implements a non-transferable (soulbound) academic credential NFT on Soroban.
//! Certificate tokens are permanently bound to the original recipient wallet.
//!
//! ## Non-Transferability Guarantee
//! `transfer` and `transfer_from` panic unconditionally for all destinations
//! except the designated burn address (`BURN_ADDRESS`), which is used only
//! for revocation workflows approved by the issuer.
//!
//! ## Issue #1177

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, Map, String, Vec,
};

// ─── Storage Keys ────────────────────────────────────────────────────────────

/// Data keys used in contract persistent storage.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Issuer address — the only account allowed to mint/revoke.
    Issuer,
    /// Burn address — transfers to this address are permitted for revocation.
    BurnAddress,
    /// `Owner(token_id)` → owner address.
    Owner(u64),
    /// `Metadata(token_id)` → CertificateRecord.
    Metadata(u64),
    /// `TokensByOwner(owner)` → Vec<u64> of token ids.
    TokensByOwner(Address),
    /// Monotonically-increasing counter for next token id.
    TokenCounter,
    /// Total supply counter.
    TotalSupply,
}

// ─── Certificate Metadata ─────────────────────────────────────────────────────

/// On-chain certificate record stored per token.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct CertificateRecord {
    /// IPFS CID or HTTPS URI pointing to off-chain JSON metadata.
    pub metadata_uri: String,
    /// Soroban timestamp (ledger close time, seconds since Unix epoch).
    pub issued_at: u64,
    /// Issuer DID (did:stellar:G…).
    pub issuer_did: String,
    /// Student wallet address.
    pub recipient: Address,
    /// Revocation flag — set to true when burned.
    pub revoked: bool,
}

// ─── Events ───────────────────────────────────────────────────────────────────

const TOPIC_MINT: soroban_sdk::Symbol = symbol_short!("mint");
const TOPIC_REVOKE: soroban_sdk::Symbol = symbol_short!("revoke");
const TOPIC_TRANSFER_BLOCKED: soroban_sdk::Symbol = symbol_short!("no_xfr");

// ─── Contract ────────────────────────────────────────────────────────────────

#[contract]
pub struct CertificateNftContract;

#[contractimpl]
impl CertificateNftContract {
    // ── Initialization ────────────────────────────────────────────────────

    /// Initialise the contract.  Must be called once after deployment.
    ///
    /// * `issuer`       – address authorised to mint and revoke certificates.
    /// * `burn_address` – the only address to which a token may be transferred
    ///                    (used exclusively for revocation workflows).
    pub fn initialize(env: Env, issuer: Address, burn_address: Address) {
        if env.storage().instance().has(&DataKey::Issuer) {
            panic!("contract already initialized");
        }
        env.storage().instance().set(&DataKey::Issuer, &issuer);
        env.storage()
            .instance()
            .set(&DataKey::BurnAddress, &burn_address);
        env.storage()
            .instance()
            .set(&DataKey::TokenCounter, &0u64);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &0u64);
    }

    // ── Minting ───────────────────────────────────────────────────────────

    /// Mint a new soulbound certificate token to `recipient`.
    ///
    /// Only callable by the registered `issuer`.
    /// Returns the newly-assigned `token_id`.
    pub fn mint(
        env: Env,
        recipient: Address,
        metadata_uri: String,
        issuer_did: String,
    ) -> u64 {
        let issuer: Address = env
            .storage()
            .instance()
            .get(&DataKey::Issuer)
            .expect("contract not initialized");
        issuer.require_auth();

        // Assign token id
        let token_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::TokenCounter)
            .unwrap_or(0u64);
        let next_id = token_id + 1;

        let record = CertificateRecord {
            metadata_uri,
            issued_at: env.ledger().timestamp(),
            issuer_did,
            recipient: recipient.clone(),
            revoked: false,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Owner(token_id), &recipient);
        env.storage()
            .persistent()
            .set(&DataKey::Metadata(token_id), &record);

        // Update owner → tokens index
        let mut tokens: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::TokensByOwner(recipient.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        tokens.push_back(token_id);
        env.storage()
            .persistent()
            .set(&DataKey::TokensByOwner(recipient.clone()), &tokens);

        // Bump counters
        env.storage()
            .instance()
            .set(&DataKey::TokenCounter, &next_id);
        let supply: u64 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0u64);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(supply + 1));

        env.events()
            .publish((TOPIC_MINT, recipient), (token_id,));

        token_id
    }

    // ── Non-Transferability ───────────────────────────────────────────────

    /// Unconditionally revert all transfer attempts.
    ///
    /// This method exists to satisfy potential SEP-0041 / generic-token
    /// interface requirements so integrations receive a clear deterministic
    /// error rather than a missing-function panic.
    ///
    /// Invariant: a soulbound certificate can NEVER move between student
    /// wallets.  The only permitted destination is the burn address, and
    /// that path is exposed via `revoke`, not this function.
    pub fn transfer(_env: Env, _from: Address, _to: Address, _token_id: u64) {
        panic!("soulbound: certificate tokens are non-transferable");
    }

    /// Unconditionally revert all operator-transfer attempts.
    ///
    /// Same guarantee as `transfer` — exists for interface completeness.
    pub fn transfer_from(
        _env: Env,
        _spender: Address,
        _from: Address,
        _to: Address,
        _token_id: u64,
    ) {
        panic!("soulbound: certificate tokens are non-transferable");
    }

    // ── Revocation ────────────────────────────────────────────────────────

    /// Revoke (burn) a certificate.
    ///
    /// Only callable by the `issuer`.  Internally this is the *only*
    /// "transfer" that may occur — the token ownership is moved to the
    /// burn address and `revoked` is set to `true`.
    pub fn revoke(env: Env, token_id: u64) {
        let issuer: Address = env
            .storage()
            .instance()
            .get(&DataKey::Issuer)
            .expect("contract not initialized");
        issuer.require_auth();

        let owner: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Owner(token_id))
            .expect("token does not exist");

        let burn_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::BurnAddress)
            .expect("burn address not set");

        // Mark token revoked in metadata
        let mut record: CertificateRecord = env
            .storage()
            .persistent()
            .get(&DataKey::Metadata(token_id))
            .expect("token metadata missing");
        record.revoked = true;
        env.storage()
            .persistent()
            .set(&DataKey::Metadata(token_id), &record);

        // Move ownership to burn address (the only permitted "transfer")
        env.storage()
            .persistent()
            .set(&DataKey::Owner(token_id), &burn_address);

        // Remove from owner's token list
        let tokens: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::TokensByOwner(owner.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        let mut updated: Vec<u64> = Vec::new(&env);
        for id in tokens.iter() {
            if id != token_id {
                updated.push_back(id);
            }
        }
        env.storage()
            .persistent()
            .set(&DataKey::TokensByOwner(owner), &updated);

        // Decrement total supply
        let supply: u64 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(1u64);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &supply.saturating_sub(1));

        env.events()
            .publish((TOPIC_REVOKE,), (token_id,));
    }

    // ── Queries ───────────────────────────────────────────────────────────

    /// Returns the owner of `token_id`.  Panics if the token does not exist.
    pub fn owner_of(env: Env, token_id: u64) -> Address {
        env.storage()
            .persistent()
            .get(&DataKey::Owner(token_id))
            .expect("token does not exist")
    }

    /// Returns the `CertificateRecord` for `token_id`.
    pub fn get_metadata(env: Env, token_id: u64) -> CertificateRecord {
        env.storage()
            .persistent()
            .get(&DataKey::Metadata(token_id))
            .expect("token does not exist")
    }

    /// Returns all token IDs owned by `owner`.
    pub fn tokens_of(env: Env, owner: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::TokensByOwner(owner))
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// Returns the total number of active (non-revoked) tokens.
    pub fn total_supply(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0u64)
    }

    /// Returns whether a certificate has been revoked.
    pub fn is_revoked(env: Env, token_id: u64) -> bool {
        let record: Option<CertificateRecord> = env
            .storage()
            .persistent()
            .get(&DataKey::Metadata(token_id));
        record.map(|r| r.revoked).unwrap_or(true)
    }

    /// Returns the registered issuer address.
    pub fn issuer(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Issuer)
            .expect("contract not initialized")
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    fn setup_contract(env: &Env) -> (Address, Address, Address, CertificateNftContractClient) {
        let contract_id = env.register_contract(None, CertificateNftContract);
        let client = CertificateNftContractClient::new(env, &contract_id);

        let issuer = Address::generate(env);
        let burn_address = Address::generate(env);

        env.mock_all_auths();
        client.initialize(&issuer, &burn_address);

        (issuer, burn_address, contract_id, client)
    }

    // ── Initialization ────────────────────────────────────────────────────

    #[test]
    fn test_initialization() {
        let env = Env::default();
        let (issuer, _, _, client) = setup_contract(&env);

        assert_eq!(client.issuer(), issuer);
        assert_eq!(client.total_supply(), 0);
    }

    #[test]
    #[should_panic(expected = "contract already initialized")]
    fn test_double_initialization_panics() {
        let env = Env::default();
        let (issuer, burn, _, client) = setup_contract(&env);

        // Second call must panic
        env.mock_all_auths();
        client.initialize(&issuer, &burn);
    }

    // ── Mint ──────────────────────────────────────────────────────────────

    #[test]
    fn test_mint_assigns_token_to_recipient() {
        let env = Env::default();
        let (_, _, _, client) = setup_contract(&env);

        let student = Address::generate(&env);
        env.mock_all_auths();

        let token_id = client.mint(
            &student,
            &String::from_str(&env, "ipfs://bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354"),
            &String::from_str(&env, "did:stellar:GABCDEF"),
        );

        assert_eq!(token_id, 0);
        assert_eq!(client.owner_of(&token_id), student);
        assert_eq!(client.total_supply(), 1);
    }

    #[test]
    fn test_mint_increments_token_ids() {
        let env = Env::default();
        let (_, _, _, client) = setup_contract(&env);

        let student1 = Address::generate(&env);
        let student2 = Address::generate(&env);
        env.mock_all_auths();

        let id0 = client.mint(
            &student1,
            &String::from_str(&env, "ipfs://cid1"),
            &String::from_str(&env, "did:stellar:G1"),
        );
        let id1 = client.mint(
            &student2,
            &String::from_str(&env, "ipfs://cid2"),
            &String::from_str(&env, "did:stellar:G2"),
        );

        assert_eq!(id0, 0);
        assert_eq!(id1, 1);
        assert_eq!(client.total_supply(), 2);
    }

    #[test]
    fn test_tokens_of_returns_all_owned_tokens() {
        let env = Env::default();
        let (_, _, _, client) = setup_contract(&env);

        let student = Address::generate(&env);
        env.mock_all_auths();

        client.mint(
            &student,
            &String::from_str(&env, "ipfs://cid1"),
            &String::from_str(&env, "did:stellar:G1"),
        );
        client.mint(
            &student,
            &String::from_str(&env, "ipfs://cid2"),
            &String::from_str(&env, "did:stellar:G1"),
        );

        let tokens = client.tokens_of(&student);
        assert_eq!(tokens.len(), 2);
    }

    // ── Non-Transferability Invariants ────────────────────────────────────

    /// INVARIANT: `transfer` MUST always panic.
    #[test]
    #[should_panic(expected = "soulbound: certificate tokens are non-transferable")]
    fn test_transfer_always_panics() {
        let env = Env::default();
        let (_, _, _, client) = setup_contract(&env);

        let student = Address::generate(&env);
        let attacker = Address::generate(&env);
        env.mock_all_auths();

        let token_id = client.mint(
            &student,
            &String::from_str(&env, "ipfs://cid"),
            &String::from_str(&env, "did:stellar:G1"),
        );

        // Any transfer attempt must revert
        client.transfer(&student, &attacker, &token_id);
    }

    /// INVARIANT: `transfer_from` MUST always panic regardless of approvals.
    #[test]
    #[should_panic(expected = "soulbound: certificate tokens are non-transferable")]
    fn test_transfer_from_always_panics() {
        let env = Env::default();
        let (_, _, _, client) = setup_contract(&env);

        let student = Address::generate(&env);
        let marketplace = Address::generate(&env);
        let buyer = Address::generate(&env);
        env.mock_all_auths();

        let token_id = client.mint(
            &student,
            &String::from_str(&env, "ipfs://cid"),
            &String::from_str(&env, "did:stellar:G1"),
        );

        // Marketplace-style operator transfer must also revert
        client.transfer_from(&marketplace, &student, &buyer, &token_id);
    }

    /// INVARIANT: transfer to burn address via normal `transfer` still panics.
    /// Only `revoke` is the approved revocation pathway.
    #[test]
    #[should_panic(expected = "soulbound: certificate tokens are non-transferable")]
    fn test_transfer_to_burn_address_also_panics() {
        let env = Env::default();
        let (_, burn_address, _, client) = setup_contract(&env);

        let student = Address::generate(&env);
        env.mock_all_auths();

        let token_id = client.mint(
            &student,
            &String::from_str(&env, "ipfs://cid"),
            &String::from_str(&env, "did:stellar:G1"),
        );

        // Even direct transfer to burn address must use `revoke` — not `transfer`
        client.transfer(&student, &burn_address, &token_id);
    }

    // ── Revocation ────────────────────────────────────────────────────────

    #[test]
    fn test_revoke_marks_token_revoked() {
        let env = Env::default();
        let (_, burn_address, _, client) = setup_contract(&env);

        let student = Address::generate(&env);
        env.mock_all_auths();

        let token_id = client.mint(
            &student,
            &String::from_str(&env, "ipfs://cid"),
            &String::from_str(&env, "did:stellar:G1"),
        );

        assert!(!client.is_revoked(&token_id));

        client.revoke(&token_id);

        assert!(client.is_revoked(&token_id));
        assert_eq!(client.owner_of(&token_id), burn_address);
        assert_eq!(client.total_supply(), 0);
    }

    #[test]
    fn test_revoke_removes_token_from_owner_list() {
        let env = Env::default();
        let (_, _, _, client) = setup_contract(&env);

        let student = Address::generate(&env);
        env.mock_all_auths();

        let token_id = client.mint(
            &student,
            &String::from_str(&env, "ipfs://cid"),
            &String::from_str(&env, "did:stellar:G1"),
        );

        let before = client.tokens_of(&student);
        assert_eq!(before.len(), 1);

        client.revoke(&token_id);

        let after = client.tokens_of(&student);
        assert_eq!(after.len(), 0);
    }

    // ── Metadata ─────────────────────────────────────────────────────────

    #[test]
    fn test_get_metadata_returns_correct_fields() {
        let env = Env::default();
        let (_, _, _, client) = setup_contract(&env);

        let student = Address::generate(&env);
        let uri = String::from_str(&env, "ipfs://bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354");
        let did = String::from_str(&env, "did:stellar:GABCDEF");
        env.mock_all_auths();

        let token_id = client.mint(&student, &uri, &did);
        let record = client.get_metadata(&token_id);

        assert_eq!(record.metadata_uri, uri);
        assert_eq!(record.recipient, student);
        assert_eq!(record.issuer_did, did);
        assert!(!record.revoked);
    }

    // ── Supply Accounting ─────────────────────────────────────────────────

    #[test]
    fn test_supply_accounting_after_mint_and_revoke() {
        let env = Env::default();
        let (_, _, _, client) = setup_contract(&env);
        env.mock_all_auths();

        let s1 = Address::generate(&env);
        let s2 = Address::generate(&env);
        let s3 = Address::generate(&env);

        let t0 = client.mint(&s1, &String::from_str(&env, "ipfs://a"), &String::from_str(&env, "did:stellar:G1"));
        let t1 = client.mint(&s2, &String::from_str(&env, "ipfs://b"), &String::from_str(&env, "did:stellar:G2"));
        let _t2 = client.mint(&s3, &String::from_str(&env, "ipfs://c"), &String::from_str(&env, "did:stellar:G3"));

        assert_eq!(client.total_supply(), 3);

        client.revoke(&t0);
        assert_eq!(client.total_supply(), 2);

        client.revoke(&t1);
        assert_eq!(client.total_supply(), 1);
    }
}
