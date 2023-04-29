import { check } from "./check";
import { EAction } from "./enums/action.enum";
import { ESubject } from "./enums/subject.enum";
import { APIGatewayProxyEvent } from "aws-lambda";

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
    } as unknown as APIGatewayProxyEvent;
    const res = check(event, EAction.Create, ESubject.ServicePoint);

    expect(res).toBe(true);
  });
});
