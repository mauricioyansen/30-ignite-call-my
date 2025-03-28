import { prisma } from "@/lib/prisma";
import dayjs from "dayjs";
import { NextApiRequest, NextApiResponse } from "next";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") return res.status(405).end();

  const username = String(req.query.username);
  const { year, month } = req.query;

  if (!year || !month)
    return res.status(400).json({ message: "Year or month not specified" });

  const user = await prisma.user.findUnique({
    where: { username },
  });

  if (!user) return res.status(400).json({ message: "User doesn't exist" });

  const availableWeekDays = await prisma.userTimeInterval.findMany({
    select: { weekDay: true },
    where: { user_id: user.id },
  });

  const blockedWeekDays = [0, 1, 2, 3, 4, 5, 6].filter((weekDay2) => {
    return !availableWeekDays.some(
      (availableWeekDay: any) => availableWeekDay.weekDay === weekDay2
    );
  });

  const blockedDatesRaw: Array<{ date: number }> = await prisma.$queryRaw`
  SELECT
    EXTRACT(DAY FROM S.date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS date,
    COUNT(S.date) AS amount,
    ((UTI.time_end_in_minutes - UTI.time_start_in_minutes) / 60) AS available_hours
  FROM scheduling S
  LEFT JOIN user_time_intervals UTI
    ON EXTRACT(DOW FROM S.date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') = UTI.week_day
    AND S.user_id = UTI.user_id
  WHERE S.user_id = ${user.id}
    AND EXTRACT(YEAR FROM S.date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') = ${year}::int
    AND EXTRACT(MONTH FROM S.date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') = ${month}::int
  GROUP BY EXTRACT(DAY FROM S.date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo'),
           ((UTI.time_end_in_minutes - UTI.time_start_in_minutes) / 60)
  HAVING COUNT(S.date) >= ((UTI.time_end_in_minutes - UTI.time_start_in_minutes) / 60)
`;

  const blockedDates = blockedDatesRaw.map((item) => Number(item.date));

  return res.json({ blockedWeekDays, blockedDates });
}
