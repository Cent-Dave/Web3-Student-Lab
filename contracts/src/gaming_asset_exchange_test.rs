use super::*;
extern crate std;
use soroban_sdk::{testutils::Address as _, Address, Env, FromVal, Map, String, Vec};

fn setup() -> (
    Env,
    Address,
    Address,
    Address,
    GamingAssetExchangeContractClient<'static>,
) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(GamingAssetExchangeContract, ());
    let client = GamingAssetExchangeContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let fee_collector = Address::generate(&env);
    client.init(&admin, &fee_collector, &250u32);
    (env, admin, fee_collector, Address::generate(&env), client)
}

fn build_asset_attributes(env: &Env) -> Map<String, String> {
    let mut attrs = Map::new(env);
    attrs.set(
        &String::from_str(env, "rarity"),
        &String::from_str(env, "epic"),
    );
    attrs.set(
        &String::from_str(env, "power"),
        &String::from_str(env, "42"),
    );
    attrs
}

#[test]
fn mint_asset_assigns_owner_and_metadata() {
    let (env, admin, _, player, client) = setup();
    let game_id = String::from_str(&env, "block_brawl");
    let name = String::from_str(&env, "Sword of Learning");
    let description = String::from_str(&env, "A beginner-friendly sword for classroom battles.");
    let image_uri = String::from_str(&env, "https://example.com/sword.png");
    let external_url = String::from_str(&env, "https://example.com/game/item/1");
    let attributes = build_asset_attributes(&env);

    let asset_id = client.mint_asset(
        &admin,
        &player,
        &game_id,
        &name,
        &description,
        &image_uri,
        &external_url,
        &attributes,
    );

    assert_eq!(asset_id, 1);
    assert!(client.asset_exists(&asset_id));
    assert_eq!(client.get_owner(&asset_id), player);

    let metadata = client.get_asset(&asset_id);
    assert_eq!(metadata.game_id, game_id);
    assert_eq!(metadata.name, name);
    assert_eq!(metadata.description, description);
    assert_eq!(metadata.image_uri, image_uri);
    assert_eq!(metadata.external_url, external_url);
    assert_eq!(
        metadata
            .attributes
            .get(&String::from_str(&env, "rarity"))
            .unwrap(),
        String::from_str(&env, "epic")
    );

    let game_assets = client.get_assets_by_game(&game_id);
    assert_eq!(game_assets.len(), 1);
    assert_eq!(game_assets.get(0).unwrap(), 1);
}

#[test]
fn list_delist_and_buy_asset_round_trip() {
    let (env, admin, _, player, client) = setup();
    let buyer = Address::generate(&env);
    let game_id = String::from_str(&env, "arena");
    let attributes = build_asset_attributes(&env);
    let asset_id = client.mint_asset(
        &admin,
        &player,
        &game_id,
        &String::from_str(&env, "Shield of Study"),
        &String::from_str(&env, "An educational shield used in learning tournaments."),
        &String::from_str(&env, "https://example.com/shield.png"),
        &String::from_str(&env, "https://example.com/game/item/2"),
        &attributes,
    );

    client.list_asset(&player, &asset_id, &500);
    assert!(client.is_listed(&asset_id));
    let listing = client.get_listing(&asset_id);
    assert_eq!(listing.seller, player);
    assert_eq!(listing.price, 500);
    assert!(listing.active);

    client.delist_asset(&player, &asset_id);
    assert!(!client.is_listed(&asset_id));

    client.list_asset(&player, &asset_id, &750);
    client.buy_asset(&buyer, &asset_id);
    assert_eq!(client.get_owner(&asset_id), buyer);
    assert!(!client.is_listed(&asset_id));
}

#[test]
#[should_panic]
fn reject_invalid_listing_price() {
    let (env, admin, _, player, client) = setup();
    let game_id = String::from_str(&env, "quest");
    let attributes = build_asset_attributes(&env);
    let asset_id = client.mint_asset(
        &admin,
        &player,
        &game_id,
        &String::from_str(&env, "Quest Helm"),
        &String::from_str(&env, "A helmet for curious learners."),
        &String::from_str(&env, "https://example.com/helm.png"),
        &String::from_str(&env, "https://example.com/game/item/3"),
        &attributes,
    );
    client.list_asset(&player, &asset_id, &0);
}

#[test]
#[should_panic]
fn reject_listing_by_non_owner() {
    let (env, admin, _, player, client) = setup();
    let other = Address::generate(&env);
    let game_id = String::from_str(&env, "quest");
    let attributes = build_asset_attributes(&env);
    let asset_id = client.mint_asset(
        &admin,
        &player,
        &game_id,
        &String::from_str(&env, "Quest Helm"),
        &String::from_str(&env, "A helmet for curious learners."),
        &String::from_str(&env, "https://example.com/helm.png"),
        &String::from_str(&env, "https://example.com/game/item/3"),
        &attributes,
    );
    client.list_asset(&other, &asset_id, &100);
}

#[test]
#[should_panic]
fn reject_buy_when_not_listed() {
    let (env, admin, _, player, client) = setup();
    let buyer = Address::generate(&env);
    let game_id = String::from_str(&env, "quest");
    let attributes = build_asset_attributes(&env);
    let asset_id = client.mint_asset(
        &admin,
        &player,
        &game_id,
        &String::from_str(&env, "Quest Helm"),
        &String::from_str(&env, "A helmet for curious learners."),
        &String::from_str(&env, "https://example.com/helm.png"),
        &String::from_str(&env, "https://example.com/game/item/3"),
        &attributes,
    );
    client.buy_asset(&buyer, &asset_id);
}

#[test]
#[should_panic]
fn reject_transfer_from_non_owner() {
    let (env, admin, _, player, client) = setup();
    let other = Address::generate(&env);
    let game_id = String::from_str(&env, "quest");
    let attributes = build_asset_attributes(&env);
    let asset_id = client.mint_asset(
        &admin,
        &player,
        &game_id,
        &String::from_str(&env, "Quest Helm"),
        &String::from_str(&env, "A helmet for curious learners."),
        &String::from_str(&env, "https://example.com/helm.png"),
        &String::from_str(&env, "https://example.com/game/item/3"),
        &attributes,
    );
    client.transfer_asset(&other, &Address::generate(&env), &asset_id);
}

#[test]
#[should_panic]
fn reject_get_nonexistent_asset() {
    let (_env, _admin, _fee_collector, _player, client) = setup();
    client.get_asset(&999);
}
