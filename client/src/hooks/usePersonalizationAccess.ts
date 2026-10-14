import { PermissionTypes, Permissions } from 'librechat-data-provider';
import useHasAccess from './Roles/useHasAccess';

export default function usePersonalizationAccess() {
  const canUseMemories = useHasAccess({
    permissionType: PermissionTypes.MEMORIES,
    permission: Permissions.USE,
  });
  const canOptOut = useHasAccess({
    permissionType: PermissionTypes.MEMORIES,
    permission: Permissions.OPT_OUT,
  });

  // Opting out only makes sense when memories are in use; `interface.memories: false`
  // revokes USE but leaves OPT_OUT granted, which would show a toggle for a disabled feature.
  const hasMemoryOptOut = canUseMemories && canOptOut;

  const hasAnyPersonalizationFeature = hasMemoryOptOut;

  return {
    hasMemoryOptOut,
    hasAnyPersonalizationFeature,
  };
}
