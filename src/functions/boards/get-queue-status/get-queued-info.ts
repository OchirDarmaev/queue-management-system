import { getServicePoints } from "../../../servicePoints/servicePoints";
import { getBoardStatus } from "./get-board-status";

export async function getQueuedInfo() {
  const servicePoints = await getServicePoints();
  return await getBoardStatus({
    servicePoints,
    // todo consider making this a parameter
    limit: 10,
  });
}
