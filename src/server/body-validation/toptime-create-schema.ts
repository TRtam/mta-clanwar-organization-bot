import { z } from "zod";

export default z.object({
  mapName: z.string().nonempty(),
  position: z.number().int(),
  playerName: z.string().nonempty(),
  time: z.number().int(),
});
