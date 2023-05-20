import { PureAbility, RawRuleOf, ForcedSubject } from "@casl/ability";
import { EAction } from "./enums/action.enum";
import { ESubject } from "./enums/subject.enum";
import { ERole } from "./enums/role.enum";

export const actions = Object.values(EAction);
export const subjects = Object.values(ESubject);

export type AppAbilities = [
  (typeof actions)[number],
  (
    | (typeof subjects)[number]
    | ForcedSubject<Exclude<(typeof subjects)[number], "all">>
  )
];
export type AppAbility = PureAbility<AppAbilities>;
export const createAbility = (rules: RawRuleOf<AppAbility>[]) =>
  new PureAbility<AppAbilities>(rules);

export type RulesByRole = Record<ERole, RawRuleOf<AppAbility>[]>;

