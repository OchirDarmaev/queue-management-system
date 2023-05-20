import { EServicePointStatus } from "../service-point-status.enum";
import { check } from "../../auth/check";
import { EAction } from "../../auth/enums/action.enum";
import { ESubject } from "../../auth/enums/subject.enum";
import { createServicePoint } from "./create-service-point";


export async function createServicePointHandler(event, context) {
  if (!check(event, EAction.Create, ESubject.ServicePoint)) {
    return {
      statusCode: 403,
      body: `Forbidden`,
    };
  }

  if (!event.body) {
    return {
      statusCode: 400,
      body: "Bad Request",
    };
  }
  try {
    const {
      servicePointId, servicePointNumber, serviceIds, name, description,
    } = JSON.parse(event.body);
    const res = await createServicePoint({
      id: servicePointId,
      serviceIds,
      name,
      description,
      servicePointStatus: EServicePointStatus.CLOSED,
      servicePointNumber,
    });
    return {
      statusCode: 201,
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
