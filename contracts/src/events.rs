//! Comprehensive event system for certificate lifecycle tracking.
//!
//! This module defines structured events for all certificate operations,
//! optimized for gas efficiency and easy parsing by indexers.
//!
//! # Stable event schema
//!
//! Every event emitted by this codebase's certificate, payment, enrollment,
//! and governance actions follows the same shape:
//!
//! ```text
//! topics: (event_name: Symbol, schema_version: Symbol, ..indexed fields)
//! data:   a single #[contracttype] struct (e.g. `PaymentProcessedEvent`)
//!         containing every field of the event, including a timestamp.
//! ```
//!
//! - `event_name` is a short, stable identifier (e.g. `"payment_processed"`)
//!   and never changes once shipped.
//! - `schema_version` (`"v1"`, `"v2"`, ...) is bumped only when a *breaking*
//!   change is made to the data struct — a field is removed, renamed, or its
//!   type/meaning changes. Adding a new field to the end of a struct is
//!   non-breaking and does not require a version bump. This lets indexers
//!   detect breaking changes by watching the version topic instead of
//!   guessing from payload shape.
//! - The data struct's field list *is* the documented, required-fields
//!   contract for that event — see the `*Event` structs below and their
//!   doc comments for the certificate/payment/enrollment/governance
//!   domains. Tests in each module assert on these fields via
//!   `env.events().all()`.

use soroban_sdk::{contracttype, Address, Bytes, BytesN, Env, String, Symbol, Vec};

/// Certificate event types for on-chain activity logging.
/// Each variant represents a distinct certificate operation.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CertificateEvent {
    /// Certificate was minted (issued)
    Minted(CertificateMintedEvent),
    /// Certificate was transferred between addresses
    Transferred(CertificateTransferredEvent),
    /// Certificate was revoked by an authority
    Revoked(CertificateRevokedEvent),
    /// Certificate was verified (validation check performed)
    Verified(CertificateVerifiedEvent),
    /// Certificate metadata was updated
    Updated(CertificateUpdatedEvent),
    /// Multiple certificates were minted in a batch
    BatchMinted(CertificateBatchMintedEvent),
    /// Certificate was renewed (TTL extended)
    Renewed(CertificateRenewedEvent),
}

/// Event data for certificate minting.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CertificateMintedEvent {
    pub token_id: u128,
    pub recipient: Address,
    pub course_id: BytesN<32>,
    pub metadata_hash: BytesN<32>,
    pub minted_at: u64,
    pub minted_by: Address,
}

/// Event data for certificate transfers.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CertificateTransferredEvent {
    pub token_id: u128,
    pub from: Address,
    pub to: Address,
    pub transferred_at: u64,
}

/// Event data for certificate revocation.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CertificateRevokedEvent {
    pub token_id: u128,
    pub revoked_by: Address,
    pub reason: u32,
    pub revoked_at: u64,
}

/// Event data for certificate verification.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CertificateVerifiedEvent {
    pub token_id: u128,
    pub verified_by: Address,
    pub verification_method: u32,
    pub verified_at: u64,
}

/// Event data for certificate metadata updates.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CertificateUpdatedEvent {
    pub token_id: u128,
    pub updated_by: Address,
    pub field_mask: u32,
    pub updated_at: u64,
}

/// Event data for batch minting operations.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CertificateBatchMintedEvent {
    pub token_ids: Vec<u128>,
    pub course_id: BytesN<32>,
    pub count: u32,
    pub minted_at: u64,
    pub minted_by: Address,
}

/// Event data for certificate renewal.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CertificateRenewedEvent {
    pub token_id: u128,
    pub renewed_by: Address,
    pub renewed_at: u64,
    pub new_expiry: u64,
}

/// Event data for a student enrolling in a course.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EnrollmentCreatedEvent {
    pub student: Address,
    pub course_id: Symbol,
    pub instructor: Address,
    pub enrolled_at: u64,
}

/// Event data for a student completing a course.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EnrollmentCompletedEvent {
    pub student: Address,
    pub course_id: Symbol,
    pub instructor: Address,
    pub completed_at: u64,
}

/// Event data for a student dropping a course.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EnrollmentDroppedEvent {
    pub student: Address,
    pub course_id: Symbol,
    pub instructor: Address,
    pub dropped_at: u64,
}

/// Event data for a payment entering escrow.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentProcessedEvent {
    pub payment_id: BytesN<32>,
    pub payer: Address,
    pub merchant: Address,
    pub amount: i128,
    pub processed_at: u64,
}

/// Event data for escrowed funds released to the merchant.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentReleasedEvent {
    pub payment_id: BytesN<32>,
    pub merchant: Address,
    pub amount: i128,
    pub released_at: u64,
}

/// Event data for escrowed funds refunded to the payer.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentRefundedEvent {
    pub payment_id: BytesN<32>,
    pub payer: Address,
    pub amount: i128,
    pub refunded_at: u64,
}

/// Event data for a payment dispute being opened.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentDisputedEvent {
    pub payment_id: BytesN<32>,
    pub opened_by: Address,
    pub amount: i128,
    pub disputed_at: u64,
}

/// Event data for an administrator resolving a payment dispute.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DisputeResolvedEvent {
    pub payment_id: BytesN<32>,
    pub admin: Address,
    /// `true` if the payer was refunded, `false` if the merchant was paid.
    pub refunded_to_payer: bool,
    pub amount: i128,
    pub resolved_at: u64,
}

/// Event data for an RBAC role grant.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RoleGrantedEvent {
    pub user: Address,
    pub role: Symbol,
    pub granted_by: Address,
    pub granted_at: u64,
}

/// Event data for an RBAC role revocation.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RoleRevokedEvent {
    pub user: Address,
    pub role: Symbol,
    pub revoked_by: Address,
    pub revoked_at: u64,
}

/// Event data for the governance module being initialized.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GovernanceInitializedEvent {
    pub admin: Address,
    pub initialized_at: u64,
}

/// Event data for a governance-credit deposit.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CreditsDepositedEvent {
    pub depositor: Address,
    pub amount: i128,
    pub deposited_at: u64,
}

/// Event data for a new governance proposal.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProposalCreatedEvent {
    pub creator: Address,
    pub proposal_id: u64,
    pub title: String,
    pub deadline: u64,
    pub created_at: u64,
}

/// Event data for a quadratic vote cast on a proposal.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VoteCastEvent {
    pub voter: Address,
    pub proposal_id: u64,
    pub vote_weight: i128,
    pub support: bool,
    pub cast_at: u64,
}

/// Event data for a proposal's voting period ending.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProposalFinalizedEvent {
    pub proposal_id: u64,
    /// Discriminant of `governance::ProposalStatus` (Active=0, Passed=1,
    /// Failed=2, Executed=3).
    pub status: u32,
    pub finalized_at: u64,
}

/// Event data for a passed proposal's action being executed.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProposalExecutedEvent {
    pub proposal_id: u64,
    pub executed_at: u64,
}

/// Event publisher helper functions.
pub struct EventPublisher<'a> {
    #[allow(dead_code)]
    env: &'a Env,
    #[allow(dead_code)]
    contract_address: Address,
}

impl<'a> EventPublisher<'a> {
    /// Create a new EventPublisher.
    pub fn new(env: &'a Env, contract_address: Address) -> Self {
        Self {
            env,
            contract_address,
        }
    }

    /// Publish a certificate minted event.
    pub fn publish_minted(
        &self,
        token_id: u128,
        recipient: &Address,
        course_id: BytesN<32>,
        metadata_hash: BytesN<32>,
        minted_by: &Address,
    ) {
        let course_id_copy = course_id.clone();
        let metadata_hash_copy = metadata_hash.clone();
        let event = CertificateMintedEvent {
            token_id,
            recipient: recipient.clone(),
            course_id,
            metadata_hash,
            minted_at: self.env.ledger().timestamp(),
            minted_by: minted_by.clone(),
        };

        self.env.events().publish(
            (
                Symbol::new(self.env, "cert_minted"),
                Symbol::new(self.env, "v2"),
            ),
            (
                token_id,
                recipient.clone(),
                course_id_copy,
                metadata_hash_copy,
                event.minted_at,
                minted_by.clone(),
            ),
        );
    }

    /// Publish a certificate revoked event.
    pub fn publish_revoked(&self, token_id: u128, revoked_by: &Address, reason: u32) {
        let event = CertificateRevokedEvent {
            token_id,
            revoked_by: revoked_by.clone(),
            reason,
            revoked_at: self.env.ledger().timestamp(),
        };

        self.env.events().publish(
            (
                Symbol::new(self.env, "cert_revoked"),
                Symbol::new(self.env, "v2"),
            ),
            (token_id, revoked_by.clone(), reason, event.revoked_at),
        );
    }

    /// Publish a batch minted event.
    pub fn publish_batch_minted(
        &self,
        token_ids: Vec<u128>,
        course_id: BytesN<32>,
        count: u32,
        minted_by: &Address,
    ) {
        let course_id_copy = course_id.clone();
        let event = CertificateBatchMintedEvent {
            minted_at: self.env.ledger().timestamp(),
            minted_by: minted_by.clone(),
            token_ids: token_ids.clone(),
            course_id,
            count,
        };

        self.env.events().publish(
            (
                Symbol::new(self.env, "batch_minted"),
                Symbol::new(self.env, "v2"),
            ),
            (
                token_ids,
                course_id_copy,
                count,
                event.minted_at,
                minted_by.clone(),
            ),
        );
    }

    /// Publish a certificate renewed event.
    pub fn publish_renewed(&self, token_id: u128, renewed_by: &Address, new_expiry: u64) {
        let event = CertificateRenewedEvent {
            token_id,
            renewed_by: renewed_by.clone(),
            renewed_at: self.env.ledger().timestamp(),
            new_expiry,
        };

        self.env.events().publish(
            (
                Symbol::new(self.env, "cert_renewed"),
                Symbol::new(self.env, "v2"),
            ),
            (token_id, renewed_by.clone(), event.renewed_at, new_expiry),
        );
    }

    /// Publish a role granted event.
    pub fn publish_role_granted(&self, caller: &Address, account: &Address, role: u32) {
        self.env.events().publish(
            (
                Symbol::new(self.env, "role_granted"),
                Symbol::new(self.env, "v2"),
            ),
            (caller.clone(), account.clone(), role),
        );
    }

    /// Publish a role revoked event.
    pub fn publish_role_revoked(&self, caller: &Address, account: &Address) {
        self.env.events().publish(
            (
                Symbol::new(self.env, "role_revoked"),
                Symbol::new(self.env, "v2"),
            ),
            (caller.clone(), account.clone()),
        );
    }

    /// Publish a pause updated event.
    pub fn publish_pause_updated(&self, caller: &Address, paused: bool) {
        self.env.events().publish(
            (
                Symbol::new(self.env, "pause_updated"),
                Symbol::new(self.env, "v2"),
            ),
            (caller.clone(), paused),
        );
    }

    /// Publish an action proposed event.
    pub fn publish_action_proposed(&self, caller: &Address, proposal_id: u64) {
        self.env.events().publish(
            (
                Symbol::new(self.env, "action_proposed"),
                Symbol::new(self.env, "v2"),
            ),
            (caller.clone(), proposal_id),
        );
    }

    /// Publish an action approved event.
    pub fn publish_action_approved(&self, caller: &Address, proposal_id: u64) {
        self.env.events().publish(
            (
                Symbol::new(self.env, "action_approved"),
                Symbol::new(self.env, "v2"),
            ),
            (caller.clone(), proposal_id),
        );
    }

    /// Publish an action executed event.
    pub fn publish_action_executed(&self, caller: &Address, proposal_id: u64) {
        self.env.events().publish(
            (
                Symbol::new(self.env, "action_executed"),
                Symbol::new(self.env, "v2"),
            ),
            (caller.clone(), proposal_id),
        );
    }

    /// Publish a mint cap updated event.
    pub fn publish_mint_cap_updated(&self, old_cap: u32, new_cap: u32) {
        self.env.events().publish(
            (
                Symbol::new(self.env, "mint_cap_updated"),
                Symbol::new(self.env, "v2"),
            ),
            (old_cap, new_cap),
        );
    }

    /// Publish a DID updated event.
    pub fn publish_did_updated(&self, caller: &Address, did: &String, timestamp: u64) {
        self.env.events().publish(
            (
                Symbol::new(self.env, "did_updated"),
                Symbol::new(self.env, "v2"),
            ),
            (caller.clone(), did.clone(), timestamp),
        );
    }

    /// Publish a DID removed event.
    pub fn publish_did_removed(&self, caller: &Address, student: &Address) {
        self.env.events().publish(
            (
                Symbol::new(self.env, "did_removed"),
                Symbol::new(self.env, "v2"),
            ),
            (caller.clone(), student.clone()),
        );
    }

    /// Publish an upgrade proposed event.
    pub fn publish_upgrade_proposed(
        &self,
        caller: &Address,
        wasm_hash: BytesN<32>,
        changelog: &String,
    ) {
        self.env.events().publish(
            (
                Symbol::new(self.env, "upgrade_proposed"),
                Symbol::new(self.env, "v2"),
            ),
            (caller.clone(), wasm_hash, changelog.clone()),
        );
    }

    /// Publish an upgrade approved event.
    pub fn publish_upgrade_approved(&self, caller: &Address, approval_mask: u32) {
        self.env.events().publish(
            (
                Symbol::new(self.env, "upgrade_approved"),
                Symbol::new(self.env, "v2"),
            ),
            (caller.clone(), approval_mask),
        );
    }

    /// Publish an upgrade executed event.
    pub fn publish_upgrade_executed(&self, caller: &Address, wasm_hash: BytesN<32>) {
        self.env.events().publish(
            (
                Symbol::new(self.env, "upgrade_executed"),
                Symbol::new(self.env, "v2"),
            ),
            (caller.clone(), wasm_hash),
        );
    }

    /// Publish an upgrade cancelled event.
    pub fn publish_upgrade_cancelled(&self, caller: &Address) {
        self.env.events().publish(
            (
                Symbol::new(self.env, "upgrade_cancelled"),
                Symbol::new(self.env, "v2"),
            ),
            (caller.clone(),),
        );
    }

    /// Publish a governance-module-initialized event.
    pub fn publish_governance_initialized(&self, admin: &Address) {
        let event = GovernanceInitializedEvent {
            admin: admin.clone(),
            initialized_at: self.env.ledger().timestamp(),
        };
        self.env.events().publish(
            (
                Symbol::new(self.env, "gov_initialized"),
                Symbol::new(self.env, "v1"),
            ),
            event,
        );
    }

    /// Publish a governance-credits-deposited event.
    pub fn publish_credits_deposited(&self, depositor: &Address, amount: i128) {
        let event = CreditsDepositedEvent {
            depositor: depositor.clone(),
            amount,
            deposited_at: self.env.ledger().timestamp(),
        };
        self.env.events().publish(
            (
                Symbol::new(self.env, "credits_deposited"),
                Symbol::new(self.env, "v1"),
            ),
            event,
        );
    }

    /// Publish a proposal created event.
    pub fn publish_proposal_created(
        &self,
        creator: &Address,
        proposal_id: u64,
        title: String,
        deadline: u64,
    ) {
        let event = ProposalCreatedEvent {
            creator: creator.clone(),
            proposal_id,
            title,
            deadline,
            created_at: self.env.ledger().timestamp(),
        };
        self.env.events().publish(
            (
                Symbol::new(self.env, "proposal_created"),
                Symbol::new(self.env, "v1"),
                proposal_id,
            ),
            event,
        );
    }

    /// Publish a vote cast event.
    pub fn publish_vote_cast(
        &self,
        voter: &Address,
        proposal_id: u64,
        vote_weight: i128,
        support: bool,
    ) {
        let event = VoteCastEvent {
            voter: voter.clone(),
            proposal_id,
            vote_weight,
            support,
            cast_at: self.env.ledger().timestamp(),
        };
        self.env.events().publish(
            (
                Symbol::new(self.env, "vote_cast"),
                Symbol::new(self.env, "v1"),
                proposal_id,
            ),
            event,
        );
    }

    /// Publish a proposal finalized event.
    pub fn publish_proposal_finalized(&self, proposal_id: u64, status: u32) {
        let event = ProposalFinalizedEvent {
            proposal_id,
            status,
            finalized_at: self.env.ledger().timestamp(),
        };
        self.env.events().publish(
            (
                Symbol::new(self.env, "proposal_finalized"),
                Symbol::new(self.env, "v1"),
                proposal_id,
            ),
            event,
        );
    }

    /// Publish a proposal executed event.
    pub fn publish_proposal_executed(&self, proposal_id: u64) {
        let event = ProposalExecutedEvent {
            proposal_id,
            executed_at: self.env.ledger().timestamp(),
        };
        self.env.events().publish(
            (
                Symbol::new(self.env, "proposal_executed"),
                Symbol::new(self.env, "v1"),
                proposal_id,
            ),
            event,
        );
    }

    /// Publish an identity verified event.
    pub fn publish_identity_verified(&self, student: &Address, did: &String) {
        self.env.events().publish(
            (
                Symbol::new(self.env, "identity_verified"),
                Symbol::new(self.env, "v2"),
            ),
            (student.clone(), did.clone()),
        );
    }

    /// Publish an emergency rollback event.
    pub fn publish_emergency_rollback(
        &self,
        signer_a: &Address,
        signer_b: &Address,
        target_version: u32,
        wasm_hash: BytesN<32>,
    ) {
        self.env.events().publish(
            (
                Symbol::new(self.env, "emergency_rollback"),
                Symbol::new(self.env, "v2"),
            ),
            (
                signer_a.clone(),
                signer_b.clone(),
                target_version,
                wasm_hash,
            ),
        );
    }

    /// Publish an admin added event.
    pub fn publish_admin_added(&self, caller: &Address, new_admin: &Address, role: u32) {
        self.env.events().publish(
            (
                Symbol::new(self.env, "admin_added"),
                Symbol::new(self.env, "v2"),
            ),
            (caller.clone(), new_admin.clone(), role),
        );
    }

    /// Publish an admin removed event.
    pub fn publish_admin_removed(&self, caller: &Address, admin_to_remove: &Address) {
        self.env.events().publish(
            (
                Symbol::new(self.env, "admin_removed"),
                Symbol::new(self.env, "v2"),
            ),
            (caller.clone(), admin_to_remove.clone()),
        );
    }

    /// Publish an ownership transferred event.
    pub fn publish_ownership_transferred(&self, caller: &Address, new_owner: &Address) {
        self.env.events().publish(
            (
                Symbol::new(self.env, "ownership_transferred"),
                Symbol::new(self.env, "v2"),
            ),
            (caller.clone(), new_owner.clone()),
        );
    }

    /// Publish a student-enrolled event.
    pub fn publish_enrollment_created(
        &self,
        student: &Address,
        course_id: &Symbol,
        instructor: &Address,
    ) {
        let event = EnrollmentCreatedEvent {
            student: student.clone(),
            course_id: course_id.clone(),
            instructor: instructor.clone(),
            enrolled_at: self.env.ledger().timestamp(),
        };
        self.env.events().publish(
            (
                Symbol::new(self.env, "student_enrolled"),
                Symbol::new(self.env, "v1"),
            ),
            event,
        );
    }

    /// Publish an enrollment-completed event.
    pub fn publish_enrollment_completed(
        &self,
        student: &Address,
        course_id: &Symbol,
        instructor: &Address,
    ) {
        let event = EnrollmentCompletedEvent {
            student: student.clone(),
            course_id: course_id.clone(),
            instructor: instructor.clone(),
            completed_at: self.env.ledger().timestamp(),
        };
        self.env.events().publish(
            (
                Symbol::new(self.env, "enrollment_completed"),
                Symbol::new(self.env, "v1"),
            ),
            event,
        );
    }

    /// Publish an enrollment-dropped event.
    pub fn publish_enrollment_dropped(
        &self,
        student: &Address,
        course_id: &Symbol,
        instructor: &Address,
    ) {
        let event = EnrollmentDroppedEvent {
            student: student.clone(),
            course_id: course_id.clone(),
            instructor: instructor.clone(),
            dropped_at: self.env.ledger().timestamp(),
        };
        self.env.events().publish(
            (
                Symbol::new(self.env, "enrollment_dropped"),
                Symbol::new(self.env, "v1"),
            ),
            event,
        );
    }

    /// Publish a payment-processed (escrowed) event.
    pub fn publish_payment_processed(
        &self,
        payment_id: BytesN<32>,
        payer: &Address,
        merchant: &Address,
        amount: i128,
    ) {
        let event = PaymentProcessedEvent {
            payment_id,
            payer: payer.clone(),
            merchant: merchant.clone(),
            amount,
            processed_at: self.env.ledger().timestamp(),
        };
        self.env.events().publish(
            (
                Symbol::new(self.env, "payment_processed"),
                Symbol::new(self.env, "v1"),
            ),
            event,
        );
    }

    /// Publish a payment-released event.
    pub fn publish_payment_released(
        &self,
        payment_id: BytesN<32>,
        merchant: &Address,
        amount: i128,
    ) {
        let event = PaymentReleasedEvent {
            payment_id,
            merchant: merchant.clone(),
            amount,
            released_at: self.env.ledger().timestamp(),
        };
        self.env.events().publish(
            (
                Symbol::new(self.env, "payment_released"),
                Symbol::new(self.env, "v1"),
            ),
            event,
        );
    }

    /// Publish a payment-refunded event.
    pub fn publish_payment_refunded(&self, payment_id: BytesN<32>, payer: &Address, amount: i128) {
        let event = PaymentRefundedEvent {
            payment_id,
            payer: payer.clone(),
            amount,
            refunded_at: self.env.ledger().timestamp(),
        };
        self.env.events().publish(
            (
                Symbol::new(self.env, "payment_refunded"),
                Symbol::new(self.env, "v1"),
            ),
            event,
        );
    }

    /// Publish a payment-disputed event.
    pub fn publish_payment_disputed(
        &self,
        payment_id: BytesN<32>,
        opened_by: &Address,
        amount: i128,
    ) {
        let event = PaymentDisputedEvent {
            payment_id,
            opened_by: opened_by.clone(),
            amount,
            disputed_at: self.env.ledger().timestamp(),
        };
        self.env.events().publish(
            (
                Symbol::new(self.env, "payment_disputed"),
                Symbol::new(self.env, "v1"),
            ),
            event,
        );
    }

    /// Publish a dispute-resolved event.
    pub fn publish_dispute_resolved(
        &self,
        payment_id: BytesN<32>,
        admin: &Address,
        refunded_to_payer: bool,
        amount: i128,
    ) {
        let event = DisputeResolvedEvent {
            payment_id,
            admin: admin.clone(),
            refunded_to_payer,
            amount,
            resolved_at: self.env.ledger().timestamp(),
        };
        self.env.events().publish(
            (
                Symbol::new(self.env, "dispute_resolved"),
                Symbol::new(self.env, "v1"),
            ),
            event,
        );
    }

    /// Publish an RBAC role-granted event with full role/grantor context.
    pub fn publish_rbac_role_granted(&self, user: &Address, role: Symbol, granted_by: &Address) {
        let event = RoleGrantedEvent {
            user: user.clone(),
            role,
            granted_by: granted_by.clone(),
            granted_at: self.env.ledger().timestamp(),
        };
        self.env.events().publish(
            (
                Symbol::new(self.env, "rbac_role_granted"),
                Symbol::new(self.env, "v1"),
            ),
            event,
        );
    }

    /// Publish an RBAC role-revoked event with full role/revoker context.
    pub fn publish_rbac_role_revoked(&self, user: &Address, role: Symbol, revoked_by: &Address) {
        let event = RoleRevokedEvent {
            user: user.clone(),
            role,
            revoked_by: revoked_by.clone(),
            revoked_at: self.env.ledger().timestamp(),
        };
        self.env.events().publish(
            (
                Symbol::new(self.env, "rbac_role_revoked"),
                Symbol::new(self.env, "v1"),
            ),
            event,
        );
    }
}

/// Event recorder that emits v2 events for the contract.
pub struct EventRecorder<'a> {
    #[allow(dead_code)]
    env: &'a Env,
    #[allow(dead_code)]
    contract_address: Address,
    pub publisher: EventPublisher<'a>,
}

impl<'a> EventRecorder<'a> {
    pub fn new(env: &'a Env, contract_address: Address) -> Self {
        Self {
            env,
            contract_address: contract_address.clone(),
            publisher: EventPublisher::new(env, contract_address),
        }
    }

    /// Record a certificate minted event.
    pub fn record_minted(
        &self,
        token_id: u128,
        recipient: &Address,
        course_id: BytesN<32>,
        metadata_hash: BytesN<32>,
        minted_by: &Address,
    ) {
        self.publisher
            .publish_minted(token_id, recipient, course_id, metadata_hash, minted_by);
    }

    /// Record a certificate revoked event.
    pub fn record_revoked(&self, token_id: u128, revoked_by: &Address, reason: u32) {
        self.publisher.publish_revoked(token_id, revoked_by, reason);
    }

    /// Record a batch minted event.
    pub fn record_batch_minted(
        &self,
        token_ids: Vec<u128>,
        course_id: BytesN<32>,
        count: u32,
        minted_by: &Address,
    ) {
        self.publisher
            .publish_batch_minted(token_ids, course_id, count, minted_by);
    }

    /// Record a certificate renewed event.
    pub fn record_renewed(&self, token_id: u128, renewed_by: &Address, new_expiry: u64) {
        self.publisher
            .publish_renewed(token_id, renewed_by, new_expiry);
    }
}

/// Helper function to generate a unique token ID from course symbol and student address.
/// This is a hash combining the course symbol and student address.
pub fn generate_token_id(env: &Env, course_symbol: &Symbol, student: &Address) -> u128 {
    use soroban_sdk::xdr::ToXdr;
    let mut buffer = Bytes::new(env);
    buffer.append(&course_symbol.clone().to_xdr(env));
    buffer.append(&student.clone().to_xdr(env));
    let hash_bytes = env.crypto().sha256(&buffer);

    // Extract first 16 bytes for u128
    let mut hash_arr = [0u8; 16];
    for (i, val) in hash_arr.iter_mut().enumerate() {
        *val = BytesN::from(hash_bytes.clone()).get(i as u32).unwrap_or(0);
    }
    u128::from_be_bytes(hash_arr)
}

/// Helper function to compute metadata hash for certificate.
pub fn compute_metadata_hash(
    env: &Env,
    course_name: &String,
    grade: &Option<String>,
    did: &Option<String>,
) -> BytesN<32> {
    use soroban_sdk::xdr::ToXdr;
    let mut buffer = Bytes::new(env);
    buffer.append(&course_name.clone().to_xdr(env));
    if let Some(g) = grade {
        buffer.append(&g.clone().to_xdr(env));
    }
    if let Some(d) = did {
        buffer.append(&d.clone().to_xdr(env));
    }
    env.crypto().sha256(&buffer).into()
}
