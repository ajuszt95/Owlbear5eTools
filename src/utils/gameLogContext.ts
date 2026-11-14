import { createContext, useContext } from "react";
import type { RollResult } from "./diceRoller";
import type { GameLogEntity, GameLogIntent } from "./gameLog";

export interface GameLogApi {
    entity: GameLogEntity | null;
    logBasic(rollId: string, result: RollResult, intent: GameLogIntent): void;
    registerPending(rollId: string, intent: GameLogIntent): void;
}

export const GameLogContext = createContext<GameLogApi | null>(null);
export const useGameLog = () => useContext(GameLogContext);
