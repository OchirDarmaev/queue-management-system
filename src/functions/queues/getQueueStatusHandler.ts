import { check } from "../../auth/check";
import { EAction } from "../../auth/enums/action.enum";
import { ESubject } from "../../auth/enums/subject.enum";
import { getQueuedInfo } from "./queue";

export async function getQueueStatusHandler(event, context) {
  if (!check(event, EAction.Read, ESubject.QueueItem)) {
    return {
      statusCode: 403,
      body: `Forbidden`,
    };
  }

  try {
    const res = await getQueuedInfo();
    return {
      statusCode: 200,
      body: JSON.stringify(res),
      headers: {
        "content-type": "application/json",
      },
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
}
