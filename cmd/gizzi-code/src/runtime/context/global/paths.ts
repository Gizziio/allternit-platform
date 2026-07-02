import path from "path"
import os from "os"
import { xdgData, xdgCache, xdgConfig, xdgState } from "xdg-basedir"

const app = "gizzi-code"

const homePath = process.env.GIZZI_TEST_HOME || os.homedir()

export namespace GlobalPaths {
  export const data = path.join(xdgData!, app)
  export const cache = path.join(xdgCache!, app)
  export const config = path.join(xdgConfig!, app)
  export const state = path.join(xdgState!, app)

  export const home = homePath
  export const bin = path.join(data, "bin")
  export const log = path.join(data, "log")
}
