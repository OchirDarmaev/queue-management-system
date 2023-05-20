import { RulesByRole } from "./create-ability.util";
import { EAction } from "./enums/action.enum";
import { ERole } from "./enums/role.enum";
import { ESubject } from "./enums/subject.enum";

export const rulesByRole: RulesByRole = {
  [ERole.Admin]: [
    { action: EAction.Manage, subject: ESubject.ServicePoints },
    { action: EAction.Manage, subject: ESubject.Services },
    { action: EAction.Manage, subject: ESubject.Queues },
  ],
  [ERole.Specialist]: [],
  [ERole.User]: [],
};
