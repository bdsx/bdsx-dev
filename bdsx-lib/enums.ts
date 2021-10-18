// enums but not found in BDS symbols

import minecraft = require('./minecraft');
import './minecraft_impl/enums';

export enum PistonAction {
    Extend = 1,
    Retract = 3,
}

export import DimensionId = minecraft.DimensionId;

export enum AttributeId {
	ZombieSpawnReinforcementsChange=1,
	PlayerHunger=2,
	PlayerSaturation=3,
	PlayerExhaustion=4,
	PlayerLevel=5,
	PlayerExperience=6,
	Health=7,
	FollowRange=8,
	KnockbackResistance=9,
	MovementSpeed=10,
	UnderwaterMovementSpeed=11,
	AttackDamage=12,
	Absorption=13,
	Luck=14,
	JumpStrength=15, // for horse?
}

export enum MobEffectIds {
    Empty,
    Speed,
    Slowness,
    Haste,
    MiningFatigue,
    Strength,
    InstantHealth,
    InstantDamage,
    JumpBoost,
    Nausea,
    Regeneration,
    Resistance,
    FireResistant,
    WaterBreathing,
    Invisibility,
    Blindness,
    NightVision,
    Hunger,
    Weakness,
    Poison,
    Wither,
    HealthBoost,
    Absorption,
    Saturation,
    Levitation,
    FatalPoison,
    ConduitPower,
    SlowFalling,
    BadOmen,
    HeroOfTheVillage,
}

export enum AttributeName {
	ZombieSpawnReinforcementsChange="minecraft:zombie.spawn.reinforcements",
	PlayerHunger="minecraft:player.hunger",
	PlayerSaturation="minecraft:player.saturation",
	PlayerExhaustion="minecraft:player.exhaustion",
	PlayerLevel="minecraft:player.level",
	PlayerExperience="minecraft:player.experience",
	Health="minecraft:health",
	FollowRange="minecraft:follow_range",
	KnockbackResistance="minecraft:knockback_registance",
	MovementSpeed="minecraft:movement",
	UnderwaterMovementSpeed="minecraft:underwater_movement",
	AttackDamage="minecraft:attack_damage",
	Absorption="minecraft:absorption",
	Luck="minecraft:luck",
	JumpStrength="minecraft:horse.jump_strength",
}

/**
 * Values from 1 to 100 are for a player's container counter.
 */
export enum ContainerId {
    Inventory,
    /** Used as the minimum value of a player's container counter. */
    First,
    /** Used as the maximum value of a player's container counter. */
    Last = 100,
    /** Used in InventoryContentPacket */
    Offhand = 119,
    /** Used in InventoryContentPacket */
    Armor,
    /** Used in InventoryContentPacket */
    Creative,
    /**
     * @deprecated
     */
    Hotbar,
    /**
     * @deprecated
     */
    FixedInventory,
    /** Used in InventoryContentPacket */
    UI,
    None = 0xFF,
}

export import DeviceOS = minecraft.BuildPlatform;

export enum DisplaySlot {
    BelowName = "belowname",
    List = "list",
    Sidebar = "sidebar",
}

// legacy
import AttributeName_ = AttributeName;
import DeviceOS_ = DeviceOS;

declare module "./common" {
	/** @deprecated import it from 'bdsx/enums' */
	type AttributeName = AttributeName_;
	/** @deprecated import it from 'bdsx/enums' */
	let AttributeName:typeof AttributeName_;

	/** @deprecated import it from 'bdsx/enums' */
	type DeviceOS = DeviceOS_;
	/** @deprecated import it from 'bdsx/enums' */
	let DeviceOS:typeof DeviceOS_;
}

import common = require('./common');
common.AttributeName = AttributeName;
common.DeviceOS = DeviceOS;
