import Image from 'next/image'

export const DottsLogo = ({
  className,
  width = 150,
  height = 50,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & { width?: number; height?: number }) => (
  <Image
    src="/dotts-logo-white.png"
    alt="Dotts Trading Cards"
    width={width}
    height={height}
    className={className}
    {...props}
  />
)

export default DottsLogo
