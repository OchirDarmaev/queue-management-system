import { EServicePointStatus } from "../service-point-status.enum";
import { check } from "../../auth/check";
import { EAction } from "../../auth/enums/action.enum";
import { ESubject } from "../../auth/enums/subject.enum";
import { updateServicePointStatus } from "./update-status-service-point";

export async function updateServicePointStatusHandler(event, context) {
  if (!check(event, EAction.UpdateStatus, ESubject.ServicePoint)) {
    return {
      statusCode: 403,
      body: `Forbidden`,
    };
  }

  try {
    const id = event.pathParameters?.servicePointId;
    if (!id) {
      return {
        statusCode: 400,
        body: "Bad Request",
      };
    }
    const status = event.pathParameters?.status as EServicePointStatus;
    if (!status) {
      return {
        statusCode: 400,
        body: "Bad Request",
      };
    }

    const res = await updateServicePointStatus({
      id,
      servicePointStatus: status,
    });
    return {
      statusCode: 200,
      body: JSON.stringify(res),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
}
