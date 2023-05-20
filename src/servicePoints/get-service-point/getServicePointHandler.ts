import { check } from "../../auth/check";
import { EAction } from "../../auth/enums/action.enum";
import { ESubject } from "../../auth/enums/subject.enum";
import { getServicePoint } from "./getServicePoint";


export async function getServicePointHandler(event, context) {
  if (!check(event, EAction.Read, ESubject.ServicePoint)) {
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
    const res = await getServicePoint({ id });
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
