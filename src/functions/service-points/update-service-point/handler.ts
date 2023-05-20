import { check } from "../../../auth/check";
import { EAction } from "../../../auth/enums/action.enum";
import { ESubject } from "../../../auth/enums/subject.enum";

export async function updateServicePointHandler(event, context) {
  if (!check(event, EAction.Update, ESubject.ServicePoint)) {
    return {
      statusCode: 403,
      body: `Forbidden`,
    };
  }

  try {
    const servicePointId = event.pathParameters?.servicePointId;
    if (!servicePointId) {
      return {
        statusCode: 400,
        body: "Bad Request",
      };
    }
    if (!event.body) {
      return {
        statusCode: 400,
        body: "Bad Request",
      };
    }
    const { serviceIds, servicePointNumber, name, description } = JSON.parse(
      event.body
    );
    const res = await updateServicePoint({
      id: servicePointId,
      serviceIds,
      name,
      description,
      servicePointNumber,
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
function updateServicePoint(arg0: {
  id: any;
  serviceIds: any;
  name: any;
  description: any;
  servicePointNumber: any;
}) {
  throw new Error("Function not implemented.");
}
