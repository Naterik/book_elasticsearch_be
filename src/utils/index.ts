import dayjs from "dayjs";
import { Timeframe } from "src/types";

export const filterWithDate = (timeframe: Timeframe) => {
  let startDate = dayjs();
  switch (timeframe) {
    case "7d":
      startDate = startDate.subtract(7, "day");
      break;
    case "1m":
      startDate = startDate.subtract(1, "month");
      break;
    case "3m":
      startDate = startDate.subtract(3, "month");
      break;
    case "6m":
      startDate = startDate.subtract(6, "month");
      break;
  }
  const start = startDate.startOf("day").toDate();
  return start;
};
