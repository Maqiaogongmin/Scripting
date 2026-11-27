import { AppIntentManager, AppIntentProtocol } from "scripting"
import { nextCover } from "./covers"

export const NextCoverIntent = AppIntentManager.register({
  name: "NextCoverIntent",
  protocol: AppIntentProtocol.AppIntent,
  perform: async (_params: undefined) => {
    await nextCover()
  },
})
