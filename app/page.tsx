import Tracker from "@/components/Tracker";
import schedule from "@/data/schedule.json";
import type { Schedule } from "@/lib/schedule";

export default function Home() {
  return <Tracker schedule={schedule as Schedule} />;
}
