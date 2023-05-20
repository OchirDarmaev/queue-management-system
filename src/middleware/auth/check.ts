import {
  APIGatewayProxyEventV2WithJWTAuthorizer,
} from "aws-lambda";
import { createAbility } from "./create-ability.util";
import { EAction } from "./enums/action.enum";
import { ESubject } from "./enums/subject.enum";
import { rulesByRole } from "./rules-by-role";
import { ERole } from "./enums/role.enum";

export function check(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  action: EAction,
  subject: ESubject
) {
  const groupsString = event.requestContext?.authorizer?.jwt?.claims[
    "cognito:groups"
  ] as string;
  // "cognito:groups": "[admin user specialist]"
  const roles = new Set(groupsString?.replace(/[[\]]/g, "").split(" "));
  const filteredRoles = Object.values(ERole).filter((role) => roles.has(role));

  return filteredRoles.some((role) =>
    createAbility(rulesByRole[role]).can(action, subject)
  );
}
