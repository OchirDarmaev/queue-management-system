import { check } from "../../auth/check";
import { EAction } from "../../auth/enums/action.enum";
import { ESubject } from "../../auth/enums/subject.enum";
import { getServicePoints } from "./getServicePoints";


export async function getServicePointsHandler(event, context) {
  if (!check(event, EAction.Read, ESubject.ServicePoint)) {
    return {
      statusCode: 403,
      body: `Forbidden`,
    };
  }

  try {
    const res = await getServicePoints();
    return res;
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
}
