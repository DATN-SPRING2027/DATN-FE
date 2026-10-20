import Image from "next/image";

interface ReferenceImageProps {
  file: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
  alt?: string;
  sizes?: string;
}

/** Local project illustrations and attributed software-team photographs. */
export default function ReferenceImage({
  file,
  alt = "",
  ...props
}: ReferenceImageProps) {
  return (
    <Image src={`/images/landing/continuum/${file}`} alt={alt} {...props} />
  );
}
