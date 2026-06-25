#![allow(clippy::too_many_arguments)]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, Map,
    String, Symbol, Vec,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AssetMetadata {
    pub game_id: String,
    pub name: String,
    pub description: String,
    pub image_uri: String,
    pub external_url: String,
    pub attributes: Map<String, String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Listing {
    pub seller: Address,
    pub price: i128,
    pub active: bool,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    AssetCounter,
    Asset(u32),          // asset_id -> AssetMetadata
    AssetOwner(u32),     // asset_id -> Address
    AssetListing(u32),   // asset_id -> Listing
    GameAssets(String),  // game_id -> Vec<u32>
    MarketplaceFeeRatio, // e.g., 250 for 2.5%
    FeeCollector,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum ExchangeError {
    NotAuthorized = 1,
    AssetNotFound = 2,
    ListingNotFound = 3,
    ListingNotActive = 4,
    InvalidPrice = 5,
    InsufficientFunds = 6,
}

#[contract]
pub struct GamingAssetExchangeContract;

#[contractimpl]
impl GamingAssetExchangeContract {
    /// Initialize the gaming asset contract and set the admin, fee collector,
    /// and marketplace fee ratio.
    pub fn init(env: Env, admin: Address, fee_collector: Address, fee_ratio: u32) {
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::FeeCollector, &fee_collector);
        env.storage()
            .instance()
            .set(&DataKey::MarketplaceFeeRatio, &fee_ratio);
        env.storage().instance().set(&DataKey::AssetCounter, &0u32);
    }

    /// Mint a new gaming asset for a game and assign ownership to `to`.
    /// Asset metadata includes attributes and an external URI for richer UIs.
    pub fn mint_asset(
        env: Env,
        caller: Address,
        to: Address,
        game_id: String,
        name: String,
        description: String,
        image_uri: String,
        external_url: String,
        attributes: Map<String, String>,
    ) -> u32 {
        caller.require_auth();

        let mut counter: u32 = env
            .storage()
            .instance()
            .get(&DataKey::AssetCounter)
            .unwrap_or(0);
        counter += 1;

        let metadata = AssetMetadata {
            game_id: game_id.clone(),
            name,
            description,
            image_uri,
            external_url,
            attributes,
        };

        env.storage()
            .instance()
            .set(&DataKey::Asset(counter), &metadata);
        env.storage()
            .instance()
            .set(&DataKey::AssetOwner(counter), &to);
        env.storage()
            .instance()
            .set(&DataKey::AssetCounter, &counter);

        let mut assets: Vec<u32> = env
            .storage()
            .instance()
            .get(&DataKey::GameAssets(game_id.clone()))
            .unwrap_or(Vec::new(&env));
        assets.push_back(counter);
        env.storage()
            .instance()
            .set(&DataKey::GameAssets(game_id), &assets);

        env.events().publish(
            (Symbol::new(&env, "Mint"), Symbol::new(&env, "asset_id")),
            (counter, to.clone()),
        );

        counter
    }

    /// Transfer a gaming asset from one address to another.
    /// Any active marketplace listing is cancelled when ownership changes.
    pub fn transfer_asset(env: Env, from: Address, to: Address, asset_id: u32) {
        from.require_auth();

        let current_owner: Address = env
            .storage()
            .instance()
            .get(&DataKey::AssetOwner(asset_id))
            .unwrap_or_else(|| panic_with_error!(&env, ExchangeError::AssetNotFound));

        if from != current_owner {
            panic_with_error!(&env, ExchangeError::NotAuthorized);
        }

        let listing_key = DataKey::AssetListing(asset_id);
        if env.storage().instance().has(&listing_key) {
            env.storage().instance().remove(&listing_key);
        }

        env.storage()
            .instance()
            .set(&DataKey::AssetOwner(asset_id), &to);

        env.events().publish(
            (Symbol::new(&env, "Transfer"), Symbol::new(&env, "asset_id")),
            (from, to, asset_id),
        );
    }

    /// List an owned asset for sale at a positive price.
    pub fn list_asset(env: Env, seller: Address, asset_id: u32, price: i128) {
        seller.require_auth();

        if price <= 0 {
            panic_with_error!(&env, ExchangeError::InvalidPrice);
        }

        let owner: Address = env
            .storage()
            .instance()
            .get(&DataKey::AssetOwner(asset_id))
            .unwrap_or_else(|| panic_with_error!(&env, ExchangeError::AssetNotFound));

        if owner != seller {
            panic_with_error!(&env, ExchangeError::NotAuthorized);
        }

        let listing = Listing {
            seller: seller.clone(),
            price,
            active: true,
        };

        env.storage()
            .instance()
            .set(&DataKey::AssetListing(asset_id), &listing);
        env.events()
            .publish((Symbol::new(&env, "Listed"),), (asset_id, seller, price));
    }

    /// Remove an active marketplace listing.
    pub fn delist_asset(env: Env, seller: Address, asset_id: u32) {
        seller.require_auth();

        let listing: Listing = env
            .storage()
            .instance()
            .get(&DataKey::AssetListing(asset_id))
            .unwrap_or_else(|| panic_with_error!(&env, ExchangeError::ListingNotFound));

        if listing.seller != seller {
            panic_with_error!(&env, ExchangeError::NotAuthorized);
        }

        env.storage()
            .instance()
            .remove(&DataKey::AssetListing(asset_id));
        env.events()
            .publish((Symbol::new(&env, "Delisted"),), (asset_id, seller));
    }

    /// Purchase an active listing. The asset owner changes and the listing is removed.
    pub fn buy_asset(env: Env, buyer: Address, asset_id: u32) {
        buyer.require_auth();

        let listing: Listing = env
            .storage()
            .instance()
            .get(&DataKey::AssetListing(asset_id))
            .unwrap_or_else(|| panic_with_error!(&env, ExchangeError::ListingNotFound));

        if !listing.active {
            panic_with_error!(&env, ExchangeError::ListingNotActive);
        }

        env.storage()
            .instance()
            .set(&DataKey::AssetOwner(asset_id), &buyer);
        env.storage()
            .instance()
            .remove(&DataKey::AssetListing(asset_id));

        env.events().publish(
            (Symbol::new(&env, "Sale"),),
            (asset_id, listing.seller, buyer, listing.price),
        );
    }

    /// Return the metadata stored for an asset.
    pub fn get_asset(env: Env, asset_id: u32) -> AssetMetadata {
        env.storage()
            .instance()
            .get(&DataKey::Asset(asset_id))
            .unwrap_or_else(|| panic_with_error!(&env, ExchangeError::AssetNotFound))
    }

    /// Return the current owner of a gaming asset.
    pub fn get_owner(env: Env, asset_id: u32) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::AssetOwner(asset_id))
            .unwrap_or_else(|| panic_with_error!(&env, ExchangeError::AssetNotFound))
    }

    /// Return an active listing for an asset.
    pub fn get_listing(env: Env, asset_id: u32) -> Listing {
        env.storage()
            .instance()
            .get(&DataKey::AssetListing(asset_id))
            .unwrap_or_else(|| panic_with_error!(&env, ExchangeError::ListingNotFound))
    }

    /// Return the list of asset IDs minted for a given game.
    pub fn get_assets_by_game(env: Env, game_id: String) -> Vec<u32> {
        env.storage()
            .instance()
            .get(&DataKey::GameAssets(game_id))
            .unwrap_or(Vec::new(&env))
    }

    /// Return whether the asset exists in contract storage.
    pub fn asset_exists(env: Env, asset_id: u32) -> bool {
        env.storage().instance().has(&DataKey::Asset(asset_id))
    }

    /// Return whether the asset is currently listed for sale.
    pub fn is_listed(env: Env, asset_id: u32) -> bool {
        env.storage()
            .instance()
            .has(&DataKey::AssetListing(asset_id))
    }
}
