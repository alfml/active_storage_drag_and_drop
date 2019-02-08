// @flow

import { dispatchEvent, defaultErrorEventUI, defaultEndEventUI, fileUploadUIPainter, fileSizeSI } from './helpers'
import { DragAndDropUploadController } from './direct_upload_controller'
export const uploaders = []

class ValidationError extends Error {
  constructor (...args) {
    super(...args)
    Error.captureStackTrace(this, ValidationError)
  }
}

export class UploadQueueProcessor {
  form: HTMLFormElement;
  currentUploaders: Array<DragAndDropUploadController>;

  constructor (form: HTMLFormElement) {
    this.form = form
    this.currentUploaders = []
    uploaders.forEach(uploader => {
      if (form === uploader.form) this.currentUploaders.push(uploader)
    })
  }

  start (callback: Function) {
    const startNextUploader = () => {
      const nextUploader = this.currentUploaders.shift()
      if (nextUploader) {
        nextUploader.start(error => {
          if (error) {
            this.dispatchError(error)
            callback(error)
          } else { startNextUploader() }
        })
      } else {
        callback()
        const event = this.dispatch('end')
        defaultEndEventUI(event)
      }
    }
    this.dispatch('start')
    startNextUploader()
  }

  dispatch (name: string, detail: {} = {}) {
    return dispatchEvent(this.form, `dnd-uploads:${name}`, { detail })
  }

  dispatchError (error: Error) {
    const event = this.dispatch('error', { error })
    defaultErrorEventUI(event)
  }
}

export function createUploader (input: HTMLInputElement, file: File) {
  // your form needs the file_field direct_upload: true, which
  //  provides data-direct-upload-url
  const error = validateUploader(input, file)
  if (error) {
    const detail = {
      id: null,
      file: file,
      iconContainer: input.dataset.iconContainerId,
      error: error
    }
    return dispatchErrorWithoutAttachment(input, detail)
  }
  if (!input.getAttribute('multiple')) { removeAttachedFiles(input) }
  uploaders.push(new DragAndDropUploadController(input, file))
}

function removeAttachedFiles (input: HTMLInputElement) {
  const zone = input.closest('label.asdndzone')
  if (!zone) return

  zone.querySelectorAll('[data-direct-upload-id]').forEach(element => { element.remove() })
  uploaders.splice(0, uploaders.length)
}

function dispatchErrorWithoutAttachment (input, detail) {
  const event = dispatchEvent(input, 'dnd-upload:error', { detail })
  if (event.defaultPrevented) return event

  const { error, iconContainer, file } = event.detail
  fileUploadUIPainter(iconContainer, 'error', file, true)
  const element = document.getElementById(`direct-upload-error`)
  if (element) {
    element.classList.add('direct-upload--error')
    element.setAttribute('title', error)
  }
  return event
}

function validateUploader (input, file) {
  const sizeLimit = parseInt(input.getAttribute('size_limit'))
  const accept = input.getAttribute('accept')
  if (accept && !accept.split(', ').includes(file.type)) {
    return new ValidationError('Invalid filetype')
  } else if (sizeLimit && file.size > sizeLimit) {
    return new ValidationError(`File too large. Can be no larger than ${fileSizeSI(sizeLimit)}`)
  }
}
