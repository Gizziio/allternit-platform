import path from "path"
import os from "os"
import { xdgData, xdgCache, xdgConfig, xdgState } from "xdg-basedir"

const app = "gizzi-code"

export const GlobalPaths = {
  data: path.join(xdgData!, app),
  cache: path.join(xdgCache!, app),
  config: path.join(xdgConfig!, app),
  state: path.join(xdgState!, app),
  get home() {
    return process.env.GIZZI_TEST_HOME || os.homedir()
  },
  bin: path.join(xdgData!, app, "bin"),
  log: path.join(xdgData!, app, "log"),
}
