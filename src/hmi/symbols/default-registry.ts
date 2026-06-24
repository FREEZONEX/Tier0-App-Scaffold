import { createRegistry, type Registry } from "./registry";
import { tank } from "./tank";
import { pump } from "./pump";
import { valve } from "./valve";
import { meter } from "./meter";
import { motor } from "./motor";
import { fan } from "./fan";
import { filter } from "./filter";
import { damper } from "./damper";
import { switchSymbol } from "./switch";
import { bargauge } from "./bargauge";
import { dialgauge } from "./dialgauge";
import { exchanger } from "./exchanger";
import { vessel } from "./vessel";
import { condenser } from "./condenser";
import { cooler } from "./cooler";
import { column } from "./column";
import { drum } from "./drum";
import { silo } from "./silo";
import { compressor } from "./compressor";
import { heater } from "./heater";
import { controlvalve } from "./controlvalve";
import { checkvalve } from "./checkvalve";
import { safetyvalve } from "./safetyvalve";
import { instrument } from "./instrument";
import { cyclone } from "./cyclone";
import { mixer } from "./mixer";
import { agitator } from "./agitator";
import { terminal } from "./terminal";
import { readout } from "./readout";

/** 内置图元集合：设备 + 容器（反应釜/接收罐）+ 换热设备（换热器/冷凝器/空冷器）+ 仪表 + 边界端子。 */
export function createDefaultRegistry(): Registry {
  return createRegistry([
    tank,
    pump,
    valve,
    meter,
    motor,
    fan,
    filter,
    damper,
    switchSymbol,
    bargauge,
    dialgauge,
    exchanger,
    vessel,
    condenser,
    cooler,
    column,
    drum,
    silo,
    compressor,
    heater,
    controlvalve,
    checkvalve,
    safetyvalve,
    instrument,
    cyclone,
    mixer,
    agitator,
    terminal,
    readout,
  ]);
}
