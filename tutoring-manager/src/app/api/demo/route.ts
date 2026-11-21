import { route } from "@/lib/api";
import { clearDemo, seedDemo } from "@/server/demo";

export const POST = route(async () => seedDemo());
export const DELETE = route(async () => clearDemo());
