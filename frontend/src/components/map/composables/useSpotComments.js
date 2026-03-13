import { useSpotComments as useSharedSpotComments } from '../../../composables/useSpotComments'

export function useSpotComments({ behavior, selectedSpot, detailsOpen, currentUserId }) {
  return useSharedSpotComments({
    selectedSpot,
    detailsOpen,
    currentUserId,
    listComments: (spotId) => behavior.listComments(spotId),
    createComment: (spotId, message) => behavior.createComment(spotId, message),
    updateComment: (commentId, message) => behavior.updateComment(commentId, message),
    deleteComment: (commentId) => behavior.deleteComment(commentId),
  })
}
