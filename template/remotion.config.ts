import { Config } from '@remotion/cli/config'

Config.setVideoImageFormat('jpeg')
// Without this the JPEG frames' full-range YUV goes into the mp4 as yuvj420p (pc range,
// bt470bg). Players read H.264 as limited range, so whites clip and the light greys wash
// out. bt709 converts to limited range and tags the stream the way every player expects.
Config.setColorSpace('bt709')
Config.setOverwriteOutput(true)
// Keep Studio + the render server off the common dev ports.
Config.setStudioPort(7811)
Config.setRendererPort(7812)
