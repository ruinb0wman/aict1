// TODO(发音): Android WebView 不实现 speechSynthesis，纯 C/S 后手机上唯一的宿主就是它，
// 需换成服务端 /api/tts（或把按钮置灰）。实测确认前别把这条注释当结论。
/** 发音：纯 Web Speech API。 */
export async function speak(text: string): Promise<boolean> {
  if (!('speechSynthesis' in window)) {
    console.error('浏览器不支持 Web Speech API')
    return false
  }

  const synth = window.speechSynthesis
  let voices = synth.getVoices()

  // 有些 WebView 首帧拿不到语音列表，等一次 onvoiceschanged
  if (voices.length === 0) {
    await new Promise<void>((resolve) => {
      const handleVoicesChanged = () => {
        voices = synth.getVoices()
        synth.onvoiceschanged = null
        resolve()
      }
      synth.onvoiceschanged = handleVoicesChanged
      setTimeout(() => {
        synth.onvoiceschanged = null
        resolve()
      }, 1000)
    })
  }

  const selectedVoice =
    voices.find(
      (v) =>
        v.name.includes('Google US English') ||
        v.name.includes('Microsoft David') ||
        v.name.includes('Samantha')
    ) || voices.find((v) => v.lang.startsWith('en'))

  synth.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  if (selectedVoice) utterance.voice = selectedVoice
  utterance.lang = 'en-US'
  utterance.rate = 0.9
  utterance.pitch = 1
  utterance.volume = 1

  synth.speak(utterance)
  return true
}
