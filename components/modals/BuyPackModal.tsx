import React from 'react'
import {
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useToast,
} from '@chakra-ui/react'
import { PackInfoWithCover } from '@pages/shop/index'
import Image from 'next/image'

type BuyPackModalProps = {
  isOpen: boolean
  onClose: () => void
  onAccept: (packId: string, quantity: number) => void
  pack: PackInfoWithCover
  quantity: number
}

const BuyPackModal = ({
  isOpen,
  onClose,
  onAccept,
  pack,
  quantity,
}: BuyPackModalProps) => {
  const totalPrice = pack.price * quantity
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader className="bg-primary text-secondary">
          {pack.label} Pack{quantity > 1 ? ` ×${quantity}` : ''}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody className="bg-primary text-secondary">
          <div className="flex flex-col justify-center items-center bg-primary text-secondary">
            <div className="w-1/2 flex flex-col justify-center items-center max-w-xs sm:max-w-sm aspect-[3/4]">
              <Image
                className="select-none"
                src={pack.cover}
                alt={`${pack.label} Pack`}
                loading="lazy"
                layout="responsive"
                width={600}
                height={800}
                style={{ objectFit: 'contain' }}
              />
            </div>
            <p className="mt-2">{pack.description}</p>
            <p className="mt-3 font-semibold text-lg">
              Total: ${new Intl.NumberFormat().format(totalPrice)}
              {quantity > 1 && (
                <span className="text-sm font-normal opacity-60 ml-2">
                  ({quantity} × ${new Intl.NumberFormat().format(pack.price)})
                </span>
              )}
            </p>
          </div>
        </ModalBody>
        <ModalFooter className="bg-primary text-secondary">
          <Button colorScheme="red" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="green" onClick={() => onAccept(pack.id, quantity)}>
            Buy {quantity > 1 ? `${quantity} Packs` : 'Pack'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default BuyPackModal
