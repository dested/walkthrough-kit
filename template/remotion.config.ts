import { Config } from '@remotion/cli/config'

Config.setVideoImageFormat('jpeg')
Config.setOverwriteOutput(true)
// Keep Studio + the render server off the common dev ports.
Config.setStudioPort(7811)
Config.setRendererPort(7812)
