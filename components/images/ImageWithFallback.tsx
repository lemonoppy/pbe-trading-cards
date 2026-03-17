import { useState, useEffect } from 'react'
import Image from 'next/image'

const ImageWithFallback = ({
  src,
  fallback = '/cardback.png',
  alt,
  ...props
}) => {
  const [currentSrc, setCurrentSrc] = useState(src || fallback)
  const [isError, setIsError] = useState(false)

  useEffect(() => {
    // Only update if src actually changed and we're not in an error state
    if (!isError) {
      if (!src) {
        setCurrentSrc(fallback)
      } else if (src !== currentSrc) {
        setCurrentSrc(src)
      }
    }
  }, [src, fallback, currentSrc, isError])

  const handleError = () => {
    if (!isError) {
      setCurrentSrc(fallback)
      setIsError(true)
    }
  }

  return <Image alt={alt} src={currentSrc} onError={handleError} {...props} />
}

export default ImageWithFallback
