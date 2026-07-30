use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, Map, Symbol, Vec,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    RBACInitialized,
    RoleDefinition(RoleLevel),
    UserRole(Address),
    UserDelegations(Address),
    Delegation(Address, Permission),
    UserTemporaryPermissions(Address),
    TemporaryPermission(Address, Permission),
    /// Distinct addresses that have co-signed off on `user` currently
    /// satisfying a `RequireMultiSig` access condition.
    ConditionApprovals(Address),
    /// Verifier rating for `RequireVerifierRating`, set by an account
    /// holding `Permission::UpdateVerifierRating`.
    VerifierRating(Address),
    /// Whether `user` has completed `course`, for `RequireCourseCompletion`.
    CourseCompletion(Address, Symbol),
    /// Token used for `RequireStakeAmount` deposits (admin-configured).
    StakeToken,
    /// Amount of `StakeToken` currently deposited by `user`.
    StakedAmount(Address),
}

// Role hierarchy levels (higher number = more permissions)
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RoleLevel {
    Student = 0,
    Verifier = 1,
    Instructor = 2,
    Auditor = 3,
    Admin = 4,
    SuperAdmin = 5,
}

// Granular permissions
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Permission {
    // Certificate operations
    MintCertificate,
    RevokeCertificate,
    BatchMint,
    UpdateMetadata,

    // Verification operations
    VerifyCertificate,
    AccreditVerifier,
    UpdateVerifierRating,

    // Role management
    GrantRole,
    RevokeRole,
    DelegatePermission,

    // System operations
    PauseContract,
    UpgradeContract,
    EmergencyStop,

    // Governance
    ProposeAction,
    ApproveAction,
    ExecuteAction,

    // Audit and monitoring
    ViewAuditLogs,
    ExportData,
    SystemMetrics,
}

// Role definition with permissions and constraints
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Role {
    pub level: RoleLevel,
    pub permissions: Vec<Permission>,
    pub can_delegate: bool,
    pub max_delegation_depth: u32,
    pub description: Symbol,
}

// Permission delegation record
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Delegation {
    pub delegator: Address,
    pub delegatee: Address,
    pub permission: Permission,
    pub expires_at: u64, // ledger number
    pub depth: u32,
    pub active: bool,
}

// Time-based permission grant
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TemporaryPermission {
    pub user: Address,
    pub permission: Permission,
    pub granted_at: u64,
    pub expires_at: u64,
    pub granted_by: Address,
}

// Attribute-based access control condition
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AccessCondition {
    RequireMultiSig(u32),            // minimum signatures required
    RequireTimeDelay(u64),           // minimum time delay in ledgers
    RequireVerifierRating(u32),      // minimum verifier rating
    RequireCourseCompletion(Symbol), // specific course completion
    RequireStakeAmount(i128),        // minimum stake amount
}

// User role assignment with conditions
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UserRole {
    pub user: Address,
    pub role: RoleLevel,
    pub granted_at: u64,
    pub granted_by: Address,
    pub expires_at: Option<u64>,
    pub conditions: Vec<AccessCondition>,
    pub active: bool,
}

// RBAC contract trait
#[contract]
pub struct RBACContract;

#[contractimpl]
impl RBACContract {
    /// Initialize RBAC system with default roles
    pub fn init_rbac(env: Env, super_admin: Address) {
        // Ensure not already initialized
        if env.storage().instance().has(&DataKey::RBACInitialized) {
            panic!("RBAC already initialized");
        }

        // Define default roles
        let roles = Self::get_default_roles(&env);

        // Store role definitions
        for (role_level, role) in roles.iter() {
            env.storage()
                .persistent()
                .set(&DataKey::RoleDefinition(role_level.clone()), &role);
        }

        // Grant SuperAdmin role to initializer
        let super_admin_role = UserRole {
            user: super_admin.clone(),
            role: RoleLevel::SuperAdmin,
            granted_at: env.ledger().sequence() as u64,
            granted_by: super_admin.clone(),
            expires_at: None,
            conditions: Vec::new(&env),
            active: true,
        };

        env.storage()
            .persistent()
            .set(&DataKey::UserRole(super_admin.clone()), &super_admin_role);

        // Mark as initialized
        env.storage()
            .instance()
            .set(&DataKey::RBACInitialized, &true);

        // Publish initialization event
        // publish_role_granted_event(&env, &super_admin, &RoleLevel::SuperAdmin, &super_admin);
    }

    /// Grant role to user with optional conditions and expiry
    pub fn grant_role(
        env: Env,
        granter: Address,
        user: Address,
        role: RoleLevel,
        expires_at: Option<u64>,
        conditions: Vec<AccessCondition>,
    ) {
        granter.require_auth();

        // Check if granter has permission to grant roles
        Self::require_permission(env.clone(), granter.clone(), Permission::GrantRole);

        // Check if granter can grant this specific role level
        let granter_role = Self::get_user_role(env.clone(), granter.clone());
        if (granter_role.role.clone() as u32) <= (role.clone() as u32) {
            panic!("Cannot grant role equal or higher than your own");
        }

        // Create user role assignment
        let user_role = UserRole {
            user: user.clone(),
            role: role.clone(),
            granted_at: env.ledger().sequence() as u64,
            granted_by: granter.clone(),
            expires_at,
            conditions,
            active: true,
        };

        // Store user role
        env.storage()
            .persistent()
            .set(&DataKey::UserRole(user.clone()), &user_role);

        // Publish event
        // publish_role_granted_event(&env, &user, &role, &granter);
    }

    /// Revoke role from user
    pub fn revoke_role(env: Env, revoker: Address, user: Address) {
        revoker.require_auth();

        // Check if revoker has permission
        Self::require_permission(env.clone(), revoker.clone(), Permission::RevokeRole);

        // Get current user role
        let mut user_role = Self::get_user_role(env.clone(), user.clone());

        // Check if revoker can revoke this role
        let revoker_role = Self::get_user_role(env.clone(), revoker.clone());
        if (revoker_role.role.clone() as u32) <= (user_role.role.clone() as u32) {
            panic!("Cannot revoke role equal or higher than your own");
        }

        // Deactivate role
        user_role.active = false;
        env.storage()
            .persistent()
            .set(&DataKey::UserRole(user.clone()), &user_role);

        // Revoke all delegations by this user
        Self::revoke_all_delegations_by_user(&env, &user);

        // Publish event
        env.events().publish(
            (soroban_sdk::symbol_short!("role_rev"), user.clone()),
            (user_role.role, revoker.clone()),
        );
    }

    /// Delegate permission to another user
    pub fn delegate_permission(
        env: Env,
        delegator: Address,
        delegatee: Address,
        permission: Permission,
        expires_at: u64,
    ) {
        delegator.require_auth();

        // Check if delegator has the permission to delegate
        Self::require_permission(env.clone(), delegator.clone(), permission.clone());
        Self::require_permission(
            env.clone(),
            delegator.clone(),
            Permission::DelegatePermission,
        );

        // Check if delegator's role allows delegation
        let delegator_role_def = Self::get_role_definition(
            env.clone(),
            Self::get_user_role(env.clone(), delegator.clone()).role,
        );
        if !delegator_role_def.can_delegate {
            panic!("Role does not allow delegation");
        }

        // Calculate delegation depth
        let depth = Self::calculate_delegation_depth(&env, &delegator, &permission) + 1;
        if depth > delegator_role_def.max_delegation_depth {
            panic!("Maximum delegation depth exceeded");
        }

        // Create delegation record
        let delegation = Delegation {
            delegator: delegator.clone(),
            delegatee: delegatee.clone(),
            permission: permission.clone(),
            expires_at,
            depth,
            active: true,
        };

        // Store delegation
        let delegation_key = DataKey::Delegation(delegatee.clone(), permission.clone());
        env.storage().persistent().set(&delegation_key, &delegation);

        // Add to delegator's delegation list
        let mut delegations = Self::get_user_delegations(&env, &delegator);
        delegations.push_back(delegation_key.clone());
        env.storage()
            .persistent()
            .set(&DataKey::UserDelegations(delegator), &delegations);
    }

    /// Grant temporary permission
    pub fn grant_temporary_permission(
        env: Env,
        granter: Address,
        user: Address,
        permission: Permission,
        duration_ledgers: u64,
    ) {
        granter.require_auth();

        // Check if granter has permission to grant this specific permission
        Self::require_permission(env.clone(), granter.clone(), permission.clone());
        Self::require_permission(env.clone(), granter.clone(), Permission::GrantRole);

        let current_ledger = env.ledger().sequence();
        let expires_at = (current_ledger as u64) + duration_ledgers;

        let temp_permission = TemporaryPermission {
            user: user.clone(),
            permission: permission.clone(),
            granted_at: current_ledger as u64,
            expires_at,
            granted_by: granter.clone(),
        };

        // Store temporary permission
        let temp_key = DataKey::TemporaryPermission(user.clone(), permission.clone());
        env.storage().persistent().set(&temp_key, &temp_permission);

        // Add to user's temporary permissions list
        let mut temp_perms = Self::get_user_temporary_permissions(&env, &user);
        temp_perms.push_back(temp_key);
        env.storage()
            .persistent()
            .set(&DataKey::UserTemporaryPermissions(user), &temp_perms);
    }

    /// Check if user has specific permission
    pub fn has_permission(env: Env, user: Address, permission: Permission) -> bool {
        // Check role-based permission
        if Self::has_role_permission(&env, &user, &permission) {
            return true;
        }

        // Check delegated permission
        if Self::has_delegated_permission(&env, &user, &permission) {
            return true;
        }

        // Check temporary permission
        if Self::has_temporary_permission(&env, &user, &permission) {
            return true;
        }

        false
    }

    /// Require user to have specific permission (panics if not)
    pub fn require_permission(env: Env, user: Address, permission: Permission) {
        if !Self::has_permission(env.clone(), user.clone(), permission) {
            panic!("Insufficient permissions");
        }
    }

    /// Get user's current role
    pub fn get_user_role(env: Env, user: Address) -> UserRole {
        match env
            .storage()
            .persistent()
            .get(&DataKey::UserRole(user.clone()))
        {
            Some(role) => {
                let user_role: UserRole = role;
                // Check if role is expired
                if let Some(expires_at) = user_role.expires_at {
                    if (env.ledger().sequence() as u64) > expires_at {
                        panic!("User role has expired");
                    }
                }
                if !user_role.active {
                    panic!("User role is inactive");
                }
                user_role
            }
            None => UserRole {
                user: user.clone(),
                role: RoleLevel::Student,
                granted_at: 0,
                granted_by: user.clone(),
                expires_at: None,
                conditions: Vec::new(&env),
                active: true,
            },
        }
    }

    /// Get role definition
    pub fn get_role_definition(env: Env, role: RoleLevel) -> Role {
        env.storage()
            .persistent()
            .get(&DataKey::RoleDefinition(role))
            .unwrap_or_else(|| panic!("Role definition not found"))
    }

    /// Update role permissions (SuperAdmin only)
    pub fn update_role_permissions(
        env: Env,
        admin: Address,
        role: RoleLevel,
        permissions: Vec<Permission>,
    ) {
        admin.require_auth();

        // Only SuperAdmin can update role definitions
        let admin_role = Self::get_user_role(env.clone(), admin.clone());
        if admin_role.role != RoleLevel::SuperAdmin {
            panic!("Only SuperAdmin can update role permissions");
        }

        let mut role_def = Self::get_role_definition(env.clone(), role.clone());
        role_def.permissions = permissions;

        env.storage()
            .persistent()
            .set(&DataKey::RoleDefinition(role.clone()), &role_def);

        env.events().publish(
            (soroban_sdk::symbol_short!("perm_upd"), role.clone()),
            admin.clone(),
        );
    }

    /// Clean up expired permissions and delegations
    pub fn cleanup_expired(env: Env, user: Address) {
        let current_ledger = env.ledger().sequence();

        // Clean up expired delegations
        let delegations = Self::get_user_delegations(&env, &user);
        let mut active_delegations = Vec::new(&env);

        for delegation_key in delegations.iter() {
            if let Some(delegation) = env
                .storage()
                .persistent()
                .get::<DataKey, Delegation>(&delegation_key)
            {
                if delegation.expires_at > (current_ledger as u64) && delegation.active {
                    active_delegations.push_back(delegation_key);
                } else {
                    env.storage().persistent().remove(&delegation_key);
                }
            }
        }

        env.storage()
            .persistent()
            .set(&DataKey::UserDelegations(user.clone()), &active_delegations);

        // Clean up expired temporary permissions
        let temp_perms = Self::get_user_temporary_permissions(&env, &user);
        let mut active_temp_perms = Vec::new(&env);

        for temp_key in temp_perms.iter() {
            if let Some(temp_perm) = env
                .storage()
                .persistent()
                .get::<DataKey, TemporaryPermission>(&temp_key)
            {
                if temp_perm.expires_at > (current_ledger as u64) {
                    active_temp_perms.push_back(temp_key);
                } else {
                    env.storage().persistent().remove(&temp_key);
                }
            }
        }

        env.storage()
            .persistent()
            .set(&DataKey::UserTemporaryPermissions(user), &active_temp_perms);
    }

    /// Co-sign a `RequireMultiSig` condition attached to `user`'s role.
    ///
    /// `approver` must hold an active role of at least `Instructor` and
    /// cannot approve their own conditions. Approvals accumulate as a set
    /// of distinct addresses; `check_access_condition` compares the count
    /// against the condition's required minimum.
    pub fn approve_condition(env: Env, approver: Address, user: Address) {
        approver.require_auth();

        if approver == user {
            panic!("Cannot approve your own condition");
        }

        let approver_role = Self::get_user_role(env.clone(), approver.clone());
        if (approver_role.role.clone() as u32) < (RoleLevel::Instructor as u32) {
            panic!("Approver role is insufficient to co-sign conditions");
        }

        let mut approvals = Self::get_condition_approvals(&env, &user);
        if !approvals.contains(&approver) {
            approvals.push_back(approver);
        }
        env.storage()
            .persistent()
            .set(&DataKey::ConditionApprovals(user), &approvals);
    }

    /// Clear accumulated multisig approvals for `user` (e.g. after a role
    /// change, so stale approvals cannot silently carry over).
    pub fn reset_condition_approvals(env: Env, caller: Address, user: Address) {
        Self::require_permission(env.clone(), caller, Permission::GrantRole);
        env.storage()
            .persistent()
            .remove(&DataKey::ConditionApprovals(user));
    }

    /// Set a user's verifier rating, used by `RequireVerifierRating`.
    /// Restricted to callers holding `Permission::UpdateVerifierRating`.
    pub fn set_verifier_rating(env: Env, caller: Address, user: Address, rating: u32) {
        caller.require_auth();
        Self::require_permission(env.clone(), caller, Permission::UpdateVerifierRating);
        env.storage()
            .persistent()
            .set(&DataKey::VerifierRating(user), &rating);
    }

    /// Record whether `user` has completed `course`, used by
    /// `RequireCourseCompletion`. Restricted to Instructor+ roles.
    pub fn set_course_completion(
        env: Env,
        granter: Address,
        user: Address,
        course: Symbol,
        completed: bool,
    ) {
        granter.require_auth();
        let granter_role = Self::get_user_role(env.clone(), granter.clone());
        if (granter_role.role.clone() as u32) < (RoleLevel::Instructor as u32) {
            panic!("Only Instructor+ roles can record course completion");
        }
        env.storage()
            .persistent()
            .set(&DataKey::CourseCompletion(user, course), &completed);
    }

    /// Configure the token used for `RequireStakeAmount` deposits.
    /// SuperAdmin only; may be called once.
    pub fn configure_stake_token(env: Env, admin: Address, token: Address) {
        admin.require_auth();
        let admin_role = Self::get_user_role(env.clone(), admin);
        if admin_role.role != RoleLevel::SuperAdmin {
            panic!("Only SuperAdmin can configure the stake token");
        }
        if env.storage().instance().has(&DataKey::StakeToken) {
            panic!("Stake token already configured");
        }
        env.storage().instance().set(&DataKey::StakeToken, &token);
    }

    /// Deposit `amount` of the configured stake token, increasing the
    /// caller's staked balance checked by `RequireStakeAmount`.
    pub fn deposit_stake(env: Env, user: Address, amount: i128) {
        user.require_auth();
        if amount <= 0 {
            panic!("Stake amount must be positive");
        }
        let token_id: Address = env
            .storage()
            .instance()
            .get(&DataKey::StakeToken)
            .unwrap_or_else(|| panic!("Stake token not configured"));

        token::Client::new(&env, &token_id).transfer(
            &user,
            &env.current_contract_address(),
            &amount,
        );

        let staked: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::StakedAmount(user.clone()))
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::StakedAmount(user), &(staked + amount));
    }

    /// Withdraw `amount` of previously staked tokens back to the caller.
    pub fn withdraw_stake(env: Env, user: Address, amount: i128) {
        user.require_auth();
        if amount <= 0 {
            panic!("Withdraw amount must be positive");
        }
        let staked: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::StakedAmount(user.clone()))
            .unwrap_or(0);
        if amount > staked {
            panic!("Insufficient staked balance");
        }
        let token_id: Address = env
            .storage()
            .instance()
            .get(&DataKey::StakeToken)
            .unwrap_or_else(|| panic!("Stake token not configured"));

        env.storage()
            .persistent()
            .set(&DataKey::StakedAmount(user.clone()), &(staked - amount));
        token::Client::new(&env, &token_id).transfer(
            &env.current_contract_address(),
            &user,
            &amount,
        );
    }

    // Private helper methods

    fn get_default_roles(env: &Env) -> Map<RoleLevel, Role> {
        let mut roles = Map::new(env);

        // Student role
        let student_permissions = Vec::from_array(env, []);
        roles.set(
            RoleLevel::Student,
            Role {
                level: RoleLevel::Student,
                permissions: student_permissions,
                can_delegate: false,
                max_delegation_depth: 0,
                description: symbol_short!("STUDENT"),
            },
        );

        // Verifier role
        let verifier_permissions = Vec::from_array(
            env,
            [Permission::VerifyCertificate, Permission::ViewAuditLogs],
        );
        roles.set(
            RoleLevel::Verifier,
            Role {
                level: RoleLevel::Verifier,
                permissions: verifier_permissions,
                can_delegate: false,
                max_delegation_depth: 0,
                description: symbol_short!("VERIFIER"),
            },
        );

        // Instructor role
        let instructor_permissions = Vec::from_array(
            env,
            [
                Permission::MintCertificate,
                Permission::UpdateMetadata,
                Permission::VerifyCertificate,
                Permission::ViewAuditLogs,
            ],
        );
        roles.set(
            RoleLevel::Instructor,
            Role {
                level: RoleLevel::Instructor,
                permissions: instructor_permissions,
                can_delegate: true,
                max_delegation_depth: 1,
                description: symbol_short!("INSTRCTR"),
            },
        );

        // Auditor role
        let auditor_permissions = Vec::from_array(
            env,
            [
                Permission::ViewAuditLogs,
                Permission::ExportData,
                Permission::SystemMetrics,
                Permission::VerifyCertificate,
            ],
        );
        roles.set(
            RoleLevel::Auditor,
            Role {
                level: RoleLevel::Auditor,
                permissions: auditor_permissions,
                can_delegate: false,
                max_delegation_depth: 0,
                description: symbol_short!("AUDITOR"),
            },
        );

        // Admin role
        let admin_permissions = Vec::from_array(
            env,
            [
                Permission::MintCertificate,
                Permission::RevokeCertificate,
                Permission::BatchMint,
                Permission::UpdateMetadata,
                Permission::VerifyCertificate,
                Permission::AccreditVerifier,
                Permission::UpdateVerifierRating,
                Permission::GrantRole,
                Permission::RevokeRole,
                Permission::DelegatePermission,
                Permission::PauseContract,
                Permission::ProposeAction,
                Permission::ApproveAction,
                Permission::ViewAuditLogs,
                Permission::ExportData,
                Permission::SystemMetrics,
            ],
        );
        roles.set(
            RoleLevel::Admin,
            Role {
                level: RoleLevel::Admin,
                permissions: admin_permissions,
                can_delegate: true,
                max_delegation_depth: 2,
                description: symbol_short!("ADMIN"),
            },
        );

        // SuperAdmin role
        let super_admin_permissions = Vec::from_array(
            env,
            [
                Permission::MintCertificate,
                Permission::RevokeCertificate,
                Permission::BatchMint,
                Permission::UpdateMetadata,
                Permission::VerifyCertificate,
                Permission::AccreditVerifier,
                Permission::UpdateVerifierRating,
                Permission::GrantRole,
                Permission::RevokeRole,
                Permission::DelegatePermission,
                Permission::PauseContract,
                Permission::UpgradeContract,
                Permission::EmergencyStop,
                Permission::ProposeAction,
                Permission::ApproveAction,
                Permission::ExecuteAction,
                Permission::ViewAuditLogs,
                Permission::ExportData,
                Permission::SystemMetrics,
            ],
        );
        roles.set(
            RoleLevel::SuperAdmin,
            Role {
                level: RoleLevel::SuperAdmin,
                permissions: super_admin_permissions,
                can_delegate: true,
                max_delegation_depth: 3,
                description: symbol_short!("SUPADMIN"),
            },
        );

        roles
    }

    fn has_role_permission(env: &Env, user: &Address, permission: &Permission) -> bool {
        let user_role = Self::get_user_role(env.clone(), user.clone());
        let role_def = Self::get_role_definition(env.clone(), user_role.role.clone());

        // Check conditions
        for condition in user_role.conditions.iter() {
            if !Self::check_access_condition(env, user, &condition, user_role.granted_at) {
                return false;
            }
        }

        role_def.permissions.contains(permission)
    }

    fn has_delegated_permission(env: &Env, user: &Address, permission: &Permission) -> bool {
        let delegation_key = DataKey::Delegation(user.clone(), permission.clone());
        if let Some(delegation) = env
            .storage()
            .persistent()
            .get::<DataKey, Delegation>(&delegation_key)
        {
            return delegation.active && (env.ledger().sequence() as u64) <= delegation.expires_at;
        }
        false
    }

    fn has_temporary_permission(env: &Env, user: &Address, permission: &Permission) -> bool {
        let temp_key = DataKey::TemporaryPermission(user.clone(), permission.clone());
        if let Some(temp_perm) = env
            .storage()
            .persistent()
            .get::<DataKey, TemporaryPermission>(&temp_key)
        {
            return (env.ledger().sequence() as u64) <= temp_perm.expires_at;
        }
        false
    }

    fn check_access_condition(
        env: &Env,
        user: &Address,
        condition: &AccessCondition,
        granted_at: u64,
    ) -> bool {
        match condition {
            AccessCondition::RequireMultiSig(min_sigs) => {
                let approvals = Self::get_condition_approvals(env, user);
                approvals.len() >= *min_sigs
            }
            AccessCondition::RequireTimeDelay(delay) => {
                (env.ledger().sequence() as u64) >= granted_at.saturating_add(*delay)
            }
            AccessCondition::RequireVerifierRating(min_rating) => {
                let rating: u32 = env
                    .storage()
                    .persistent()
                    .get(&DataKey::VerifierRating(user.clone()))
                    .unwrap_or(0);
                rating >= *min_rating
            }
            AccessCondition::RequireCourseCompletion(course) => env
                .storage()
                .persistent()
                .get(&DataKey::CourseCompletion(user.clone(), course.clone()))
                .unwrap_or(false),
            AccessCondition::RequireStakeAmount(amount) => {
                let staked: i128 = env
                    .storage()
                    .persistent()
                    .get(&DataKey::StakedAmount(user.clone()))
                    .unwrap_or(0);
                staked >= *amount
            }
        }
    }

    fn get_condition_approvals(env: &Env, user: &Address) -> Vec<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::ConditionApprovals(user.clone()))
            .unwrap_or_else(|| Vec::new(env))
    }

    fn calculate_delegation_depth(env: &Env, user: &Address, permission: &Permission) -> u32 {
        let delegation_key = DataKey::Delegation(user.clone(), permission.clone());
        if let Some(delegation) = env
            .storage()
            .persistent()
            .get::<DataKey, Delegation>(&delegation_key)
        {
            return delegation.depth;
        }
        0
    }

    fn get_user_delegations(env: &Env, user: &Address) -> Vec<DataKey> {
        env.storage()
            .persistent()
            .get(&DataKey::UserDelegations(user.clone()))
            .unwrap_or_else(|| Vec::new(env))
    }

    fn get_user_temporary_permissions(env: &Env, user: &Address) -> Vec<DataKey> {
        env.storage()
            .persistent()
            .get(&DataKey::UserTemporaryPermissions(user.clone()))
            .unwrap_or_else(|| Vec::new(env))
    }

    fn revoke_all_delegations_by_user(env: &Env, user: &Address) {
        let delegations = Self::get_user_delegations(env, user);
        for delegation_key in delegations.iter() {
            if let Some(mut delegation) = env
                .storage()
                .persistent()
                .get::<DataKey, Delegation>(&delegation_key)
            {
                delegation.active = false;
                env.storage().persistent().set(&delegation_key, &delegation);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger, LedgerInfo};
    use soroban_sdk::token;

    fn setup() -> (Env, RBACContractClient<'static>, Address) {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(RBACContract, ());
        let client = RBACContractClient::new(&env, &contract_id);

        let super_admin = Address::generate(&env);
        client.init_rbac(&super_admin);

        (env, client, super_admin)
    }

    fn bump_sequence(env: &Env, by: u32) {
        let current = env.ledger().sequence();
        env.ledger().set(LedgerInfo {
            timestamp: env.ledger().timestamp(),
            protocol_version: 22,
            sequence_number: current + by,
            network_id: Default::default(),
            base_reserve: 10,
            min_temp_entry_ttl: 1,
            min_persistent_entry_ttl: 1,
            max_entry_ttl: 6_312_000,
        });
    }

    #[test]
    fn test_unconditional_role_grants_permission_immediately() {
        let (env, client, super_admin) = setup();
        let user = Address::generate(&env);

        client.grant_role(
            &super_admin,
            &user,
            &RoleLevel::Instructor,
            &None,
            &Vec::new(&env),
        );

        assert!(client.has_permission(&user, &Permission::MintCertificate));
    }

    #[test]
    #[should_panic(expected = "Insufficient permissions")]
    fn test_unauthorized_call_fails() {
        let (env, client, _super_admin) = setup();
        let rando = Address::generate(&env);

        // Default (Student) role has no permissions at all.
        client.require_permission(&rando, &Permission::GrantRole);
    }

    #[test]
    fn test_stake_condition_denies_until_real_stake_deposited() {
        let (env, client, super_admin) = setup();
        let user = Address::generate(&env);

        let token_admin = Address::generate(&env);
        let token_id = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();
        token::StellarAssetClient::new(&env, &token_id).mint(&user, &10_000);

        client.configure_stake_token(&super_admin, &token_id);

        let mut conditions = Vec::new(&env);
        conditions.push_back(AccessCondition::RequireStakeAmount(1_000));
        client.grant_role(
            &super_admin,
            &user,
            &RoleLevel::Instructor,
            &None,
            &conditions,
        );

        // Condition unmet: no real stake backing the role yet.
        assert!(!client.has_permission(&user, &Permission::MintCertificate));

        client.deposit_stake(&user, &500);
        assert!(!client.has_permission(&user, &Permission::MintCertificate));

        client.deposit_stake(&user, &500);
        assert!(client.has_permission(&user, &Permission::MintCertificate));
        assert_eq!(
            token::Client::new(&env, &token_id).balance(&user),
            10_000 - 1_000
        );

        // Withdrawing back below the threshold revokes the condition again.
        client.withdraw_stake(&user, &200);
        assert!(!client.has_permission(&user, &Permission::MintCertificate));
    }

    #[test]
    fn test_verifier_rating_condition_denies_until_rated() {
        let (env, client, super_admin) = setup();
        let user = Address::generate(&env);

        let mut conditions = Vec::new(&env);
        conditions.push_back(AccessCondition::RequireVerifierRating(80));
        client.grant_role(
            &super_admin,
            &user,
            &RoleLevel::Verifier,
            &None,
            &conditions,
        );

        assert!(!client.has_permission(&user, &Permission::VerifyCertificate));

        client.set_verifier_rating(&super_admin, &user, &50);
        assert!(!client.has_permission(&user, &Permission::VerifyCertificate));

        client.set_verifier_rating(&super_admin, &user, &80);
        assert!(client.has_permission(&user, &Permission::VerifyCertificate));
    }

    #[test]
    #[should_panic]
    fn test_unrated_verifier_cannot_set_own_rating() {
        let (env, client, super_admin) = setup();
        let user = Address::generate(&env);
        client.grant_role(
            &super_admin,
            &user,
            &RoleLevel::Verifier,
            &None,
            &Vec::new(&env),
        );

        // A plain Verifier lacks Permission::UpdateVerifierRating.
        client.set_verifier_rating(&user, &user, &100);
    }

    #[test]
    fn test_course_completion_condition_denies_until_recorded() {
        let (env, client, super_admin) = setup();
        let user = Address::generate(&env);
        let course = symbol_short!("RUST101");

        let mut conditions = Vec::new(&env);
        conditions.push_back(AccessCondition::RequireCourseCompletion(course.clone()));
        client.grant_role(
            &super_admin,
            &user,
            &RoleLevel::Instructor,
            &None,
            &conditions,
        );

        assert!(!client.has_permission(&user, &Permission::MintCertificate));

        client.set_course_completion(&super_admin, &user, &course, &true);
        assert!(client.has_permission(&user, &Permission::MintCertificate));
    }

    #[test]
    fn test_time_delay_condition_denies_until_delay_elapses() {
        let (env, client, super_admin) = setup();
        let user = Address::generate(&env);

        let mut conditions = Vec::new(&env);
        conditions.push_back(AccessCondition::RequireTimeDelay(50));
        client.grant_role(
            &super_admin,
            &user,
            &RoleLevel::Instructor,
            &None,
            &conditions,
        );

        assert!(!client.has_permission(&user, &Permission::MintCertificate));

        bump_sequence(&env, 49);
        assert!(!client.has_permission(&user, &Permission::MintCertificate));

        bump_sequence(&env, 1);
        assert!(client.has_permission(&user, &Permission::MintCertificate));
    }

    #[test]
    fn test_multisig_condition_requires_distinct_approvers() {
        let (env, client, super_admin) = setup();
        let user = Address::generate(&env);
        let approver1 = Address::generate(&env);
        let approver2 = Address::generate(&env);

        client.grant_role(
            &super_admin,
            &approver1,
            &RoleLevel::Instructor,
            &None,
            &Vec::new(&env),
        );
        client.grant_role(
            &super_admin,
            &approver2,
            &RoleLevel::Instructor,
            &None,
            &Vec::new(&env),
        );

        let mut conditions = Vec::new(&env);
        conditions.push_back(AccessCondition::RequireMultiSig(2));
        client.grant_role(
            &super_admin,
            &user,
            &RoleLevel::Instructor,
            &None,
            &conditions,
        );

        assert!(!client.has_permission(&user, &Permission::MintCertificate));

        client.approve_condition(&approver1, &user);
        // Re-approving with the same signer must not count twice.
        client.approve_condition(&approver1, &user);
        assert!(!client.has_permission(&user, &Permission::MintCertificate));

        client.approve_condition(&approver2, &user);
        assert!(client.has_permission(&user, &Permission::MintCertificate));
    }

    #[test]
    #[should_panic(expected = "Cannot approve your own condition")]
    fn test_cannot_self_approve_multisig_condition() {
        let (env, client, super_admin) = setup();
        let user = Address::generate(&env);
        client.grant_role(
            &super_admin,
            &user,
            &RoleLevel::Instructor,
            &None,
            &Vec::new(&env),
        );

        client.approve_condition(&user, &user);
    }

    #[test]
    #[should_panic(expected = "User role is inactive")]
    fn test_revoked_role_loses_access() {
        let (env, client, super_admin) = setup();
        let user = Address::generate(&env);
        client.grant_role(
            &super_admin,
            &user,
            &RoleLevel::Instructor,
            &None,
            &Vec::new(&env),
        );
        assert!(client.has_permission(&user, &Permission::MintCertificate));

        client.revoke_role(&super_admin, &user);

        // A revoked role surfaces as an error (existing get_user_role
        // behavior) rather than silently falling back to Student.
        client.has_permission(&user, &Permission::MintCertificate);
    }
}
