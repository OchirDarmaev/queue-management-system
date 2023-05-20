import { check } from "./check";
import { EAction } from "./enums/action.enum";
import { ESubject } from "./enums/subject.enum";
import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";

describe("check", () => {
  it("should return true", () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              "cognito:groups": "[admin Test]",
            },
          },
        },
      },
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
    const res = check(event, EAction.Create, ESubject.ServicePoint);

    expect(res).toBe(true);
  });

  it("should return false", () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              "cognito:groups": "[]",
            },
          },
        },
      },
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
    const res = check(event, EAction.Create, ESubject.ServicePoint);

    expect(res).toBe(false);
  });
});
