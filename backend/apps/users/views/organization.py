"""
OrganizationViewSet for organization management.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiResponse, OpenApiParameter
from apps.users.models import User, Organization, OrganizationMembership, OrganizationInvitation
from apps.users.serializers import (
    OrganizationSerializer,
    OrganizationMembershipSerializer,
    OrganizationMembershipListSerializer,
    OrganizationInvitationSerializer,
    CreateInvitationSerializer,
    AcceptInvitationSerializer,
    InvitationPreviewSerializer,
    BulkInvitationSerializer,
    BulkInvitationResultSerializer,
    UserSerializer
)
from common.serializers import ErrorResponseSerializer


@extend_schema_view(
    list=extend_schema(
        operation_id='organizations_list',
        tags=['Organizations'],
        summary='List Organizations',
        description='Get a list of organizations the current user is a member of.',
        responses={
            200: OpenApiResponse(response=OrganizationSerializer(many=True), description='List of organizations'),
            401: OpenApiResponse(response=ErrorResponseSerializer, description='Authentication required'),
        }
    ),
    retrieve=extend_schema(
        operation_id='organizations_retrieve',
        tags=['Organizations'],
        summary='Get Organization',
        description='Retrieve a specific organization by ID.',
        responses={
            200: OpenApiResponse(response=OrganizationSerializer, description='Organization details'),
            401: OpenApiResponse(response=ErrorResponseSerializer, description='Authentication required'),
            404: OpenApiResponse(response=ErrorResponseSerializer, description='Organization not found'),
        }
    ),
    create=extend_schema(
        operation_id='organizations_create',
        tags=['Organizations'],
        summary='Create Organization',
        description='Create a new organization.',
        request=OrganizationSerializer,
        responses={
            201: OpenApiResponse(response=OrganizationSerializer, description='Organization created successfully'),
            400: OpenApiResponse(response=ErrorResponseSerializer, description='Invalid request data'),
            401: OpenApiResponse(response=ErrorResponseSerializer, description='Authentication required'),
        }
    ),
    update=extend_schema(
        operation_id='organizations_update',
        tags=['Organizations'],
        summary='Update Organization',
        description='Update an organization.',
        request=OrganizationSerializer,
        responses={
            200: OpenApiResponse(response=OrganizationSerializer, description='Organization updated successfully'),
            400: OpenApiResponse(response=ErrorResponseSerializer, description='Invalid request data'),
            401: OpenApiResponse(response=ErrorResponseSerializer, description='Authentication required'),
            404: OpenApiResponse(response=ErrorResponseSerializer, description='Organization not found'),
        }
    ),
    partial_update=extend_schema(
        operation_id='organizations_partial_update',
        tags=['Organizations'],
        summary='Partially Update Organization',
        description='Partially update an organization.',
        request=OrganizationSerializer,
        responses={
            200: OpenApiResponse(response=OrganizationSerializer, description='Organization updated successfully'),
            400: OpenApiResponse(response=ErrorResponseSerializer, description='Invalid request data'),
            401: OpenApiResponse(response=ErrorResponseSerializer, description='Authentication required'),
            404: OpenApiResponse(response=ErrorResponseSerializer, description='Organization not found'),
        }
    ),
    destroy=extend_schema(
        operation_id='organizations_destroy',
        tags=['Organizations'],
        summary='Delete Organization',
        description='Delete an organization.',
        responses={
            204: OpenApiResponse(description='Organization deleted successfully'),
            401: OpenApiResponse(response=ErrorResponseSerializer, description='Authentication required'),
            404: OpenApiResponse(response=ErrorResponseSerializer, description='Organization not found'),
        }
    ),
)
class OrganizationViewSet(viewsets.ModelViewSet):
    """ViewSet for Organization model."""
    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter organizations to only those the user is a member of."""
        return self.queryset.filter(members=self.request.user)

    def perform_create(self, serializer):
        """Create organization and add the creator as an admin."""
        organization = serializer.save()

        # Add the creating user as an admin of the organization
        OrganizationMembership.objects.create(
            organization=organization,
            user=self.request.user,
            role=OrganizationMembership.Role.ADMIN
        )

    def perform_update(self, serializer):
        """Update organization and mark onboarding as complete when plan is selected."""
        organization = self.get_object()

        # If plan is being updated and onboarding hasn't been completed yet
        if 'plan' in serializer.validated_data and not organization.onboarding_completed_at:
            serializer.save(onboarding_completed_at=timezone.now())
        else:
            serializer.save()

    @extend_schema(
        operation_id='organizations_members',
        tags=['Organizations'],
        summary='List Organization Members',
        description='Get a list of all members in the organization.',
        responses={
            200: OpenApiResponse(response=OrganizationMembershipListSerializer(many=True), description='List of members'),
            401: OpenApiResponse(response=ErrorResponseSerializer, description='Authentication required'),
            404: OpenApiResponse(response=ErrorResponseSerializer, description='Organization not found'),
        }
    )
    @action(detail=True, methods=['get'])
    def members(self, request, pk=None):
        """List organization members."""
        organization = self.get_object()
        memberships = OrganizationMembership.objects.filter(
            organization=organization
        ).select_related('user')
        serializer = OrganizationMembershipListSerializer(memberships, many=True)
        return Response(serializer.data)

    @extend_schema(
        operation_id='organizations_invite_member',
        tags=['Organizations'],
        summary='Invite Member to Organization',
        description='Send an invitation to join the organization by email.',
        request=CreateInvitationSerializer,
        responses={
            201: OpenApiResponse(response=OrganizationInvitationSerializer, description='Invitation sent successfully'),
            400: OpenApiResponse(response=ErrorResponseSerializer, description='Invalid request data'),
            401: OpenApiResponse(response=ErrorResponseSerializer, description='Authentication required'),
            403: OpenApiResponse(response=ErrorResponseSerializer, description='Permission denied'),
            404: OpenApiResponse(response=ErrorResponseSerializer, description='Organization not found'),
        }
    )
    @action(detail=True, methods=['post'])
    def invite_member(self, request, pk=None):
        """Send an invitation to join the organization."""
        organization = self.get_object()

        # Check if user is admin of this organization
        is_admin = OrganizationMembership.objects.filter(
            user=request.user,
            organization=organization,
            role=OrganizationMembership.Role.ADMIN
        ).exists()
        if not is_admin:
            raise PermissionDenied("You must be an admin of this organization to invite members.")

        serializer = CreateInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        role = serializer.validated_data.get('role', 'member')

        # Check if user is already a member
        existing_user = User.objects.filter(email=email).first()
        if existing_user:
            if OrganizationMembership.objects.filter(
                organization=organization,
                user=existing_user
            ).exists():
                return Response(
                    {'error': 'User is already a member of this organization'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Check if there's already a pending invitation
        existing_invitation = OrganizationInvitation.objects.filter(
            organization=organization,
            email=email,
            status=OrganizationInvitation.Status.PENDING
        ).first()

        if existing_invitation and existing_invitation.is_valid():
            return Response(
                {'error': 'A pending invitation already exists for this email'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create the invitation
        invitation = OrganizationInvitation.objects.create(
            organization=organization,
            email=email,
            role=role,
            invited_by=request.user
        )

        # Send invitation email
        from apps.users.services.email_service import send_organization_invitation_email

        invited_by_name = request.user.get_full_name() or request.user.email
        email_sent = send_organization_invitation_email(
            email=email,
            token=str(invitation.token),
            organization_name=organization.name,
            invited_by_name=invited_by_name,
            role=role
        )

        if not email_sent:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to send invitation email to {email} for organization {organization.id}")

        response_serializer = OrganizationInvitationSerializer(invitation)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    @extend_schema(
        operation_id='organizations_bulk_invite_members',
        tags=['Organizations'],
        summary='Bulk Invite Members to Organization',
        description='Send invitations to multiple users at once.',
        request=BulkInvitationSerializer,
        responses={
            200: OpenApiResponse(response=BulkInvitationResultSerializer, description='Bulk invite results'),
            400: OpenApiResponse(response=ErrorResponseSerializer, description='Invalid request data'),
            401: OpenApiResponse(response=ErrorResponseSerializer, description='Authentication required'),
            403: OpenApiResponse(response=ErrorResponseSerializer, description='Permission denied'),
            404: OpenApiResponse(response=ErrorResponseSerializer, description='Organization not found'),
        }
    )
    @action(detail=True, methods=['post'], url_path='bulk-invite-members')
    def bulk_invite_members(self, request, pk=None):
        """Send invitations to multiple users at once."""
        organization = self.get_object()

        # Check if user is admin of this organization
        is_admin = OrganizationMembership.objects.filter(
            user=request.user,
            organization=organization,
            role=OrganizationMembership.Role.ADMIN
        ).exists()
        if not is_admin:
            raise PermissionDenied("You must be an admin of this organization to invite members.")

        serializer = BulkInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        emails = serializer.validated_data['emails']
        role = serializer.validated_data.get('role', 'member')

        successful = []
        skipped = []
        errors = []

        for email in emails:
            try:
                # Check if user is already a member
                existing_user = User.objects.filter(email=email).first()
                if existing_user:
                    if OrganizationMembership.objects.filter(
                        organization=organization,
                        user=existing_user
                    ).exists():
                        skipped.append({
                            'email': email,
                            'reason': 'User is already a member of this organization'
                        })
                        continue

                # Check if there's already a pending invitation
                existing_invitation = OrganizationInvitation.objects.filter(
                    organization=organization,
                    email=email,
                    status=OrganizationInvitation.Status.PENDING
                ).first()

                if existing_invitation and existing_invitation.is_valid():
                    skipped.append({
                        'email': email,
                        'reason': 'A pending invitation already exists for this email'
                    })
                    continue

                # Create the invitation
                invitation = OrganizationInvitation.objects.create(
                    organization=organization,
                    email=email,
                    role=role,
                    invited_by=request.user
                )

                # Send invitation email
                from apps.users.services.email_service import send_organization_invitation_email

                invited_by_name = request.user.get_full_name() or request.user.email
                email_sent = send_organization_invitation_email(
                    email=email,
                    token=str(invitation.token),
                    organization_name=organization.name,
                    invited_by_name=invited_by_name,
                    role=role
                )

                if not email_sent:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"Failed to send invitation email to {email} for organization {organization.id}")
                    invitation.delete()
                    errors.append({
                        'email': email,
                        'error': 'Failed to send invitation email'
                    })
                else:
                    successful.append(invitation)

            except Exception as e:
                errors.append({
                    'email': email,
                    'error': str(e)
                })

        result = {
            'successful': OrganizationInvitationSerializer(successful, many=True).data,
            'skipped': skipped,
            'errors': errors
        }

        return Response(result, status=status.HTTP_200_OK)

    @extend_schema(
        operation_id='organizations_remove_member',
        tags=['Organizations'],
        summary='Remove Member from Organization',
        description='Remove a member from the organization (requires admin permissions).',
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'user_id': {'type': 'string', 'description': 'ID of the user to remove'},
                },
                'required': ['user_id'],
            }
        },
        responses={
            204: OpenApiResponse(description='Member removed successfully'),
            400: OpenApiResponse(response=ErrorResponseSerializer, description='Cannot remove the last admin'),
            401: OpenApiResponse(response=ErrorResponseSerializer, description='Authentication required'),
            404: OpenApiResponse(response=ErrorResponseSerializer, description='Member or organization not found'),
        }
    )
    @action(detail=True, methods=['delete'])
    def remove_member(self, request, pk=None):
        """Remove a member from the organization."""
        organization = self.get_object()

        # Check if user is admin of this organization
        is_admin = OrganizationMembership.objects.filter(
            user=request.user,
            organization=organization,
            role=OrganizationMembership.Role.ADMIN
        ).exists()
        if not is_admin:
            raise PermissionDenied("You must be an admin of this organization to remove members.")

        user_id = request.data.get('user_id')

        membership = get_object_or_404(
            OrganizationMembership,
            organization=organization,
            user_id=user_id
        )

        # Prevent removing the last admin
        if membership.role == OrganizationMembership.Role.ADMIN:
            admin_count = OrganizationMembership.objects.filter(
                organization=organization,
                role=OrganizationMembership.Role.ADMIN
            ).count()
            if admin_count <= 1:
                return Response(
                    {'error': 'Cannot remove the last admin'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Note: Article ownership check removed - using KnowledgeItem which doesn't have
        # individual ownership. All content is owned at the organization level.

        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(
        operation_id='organizations_list_invitations',
        tags=['Organizations'],
        summary='List Pending Invitations',
        description='Get a list of all pending invitations for the organization.',
        responses={
            200: OpenApiResponse(response=OrganizationInvitationSerializer(many=True), description='List of pending invitations'),
            401: OpenApiResponse(response=ErrorResponseSerializer, description='Authentication required'),
            403: OpenApiResponse(response=ErrorResponseSerializer, description='Permission denied'),
            404: OpenApiResponse(response=ErrorResponseSerializer, description='Organization not found'),
        }
    )
    @action(detail=True, methods=['get'])
    def invitations(self, request, pk=None):
        """List pending invitations for the organization."""
        organization = self.get_object()

        # Check if user is admin of this organization
        is_admin = OrganizationMembership.objects.filter(
            user=request.user,
            organization=organization,
            role=OrganizationMembership.Role.ADMIN
        ).exists()
        if not is_admin:
            raise PermissionDenied("You must be an admin of this organization to view invitations.")

        invitations = OrganizationInvitation.objects.filter(
            organization=organization,
            status=OrganizationInvitation.Status.PENDING
        ).select_related('invited_by', 'organization')

        serializer = OrganizationInvitationSerializer(invitations, many=True)
        return Response(serializer.data)

    @extend_schema(
        operation_id='organizations_cancel_invitation',
        tags=['Organizations'],
        summary='Cancel an Invitation',
        description='Cancel a pending invitation to join the organization.',
        parameters=[
            OpenApiParameter(
                name='invitation_id',
                type=str,
                location=OpenApiParameter.PATH,
                description='UUID of the invitation to cancel'
            )
        ],
        responses={
            204: OpenApiResponse(description='Invitation canceled successfully'),
            403: OpenApiResponse(response=ErrorResponseSerializer, description='Permission denied'),
            404: OpenApiResponse(response=ErrorResponseSerializer, description='Invitation not found'),
        }
    )
    @action(detail=True, methods=['delete'], url_path='invitations/(?P<invitation_id>[^/.]+)')
    def cancel_invitation(self, request, pk=None, invitation_id=None):
        """Cancel a pending invitation."""
        organization = self.get_object()

        # Check if user is admin of this organization
        is_admin = OrganizationMembership.objects.filter(
            user=request.user,
            organization=organization,
            role=OrganizationMembership.Role.ADMIN
        ).exists()
        if not is_admin:
            raise PermissionDenied("You must be an admin of this organization to cancel invitations.")

        invitation = get_object_or_404(
            OrganizationInvitation,
            id=invitation_id,
            organization=organization
        )

        if invitation.status != OrganizationInvitation.Status.PENDING:
            return Response(
                {'error': 'Can only cancel pending invitations'},
                status=status.HTTP_400_BAD_REQUEST
            )

        invitation.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(
        operation_id='organizations_resend_invitation',
        tags=['Organizations'],
        summary='Resend an Invitation',
        description='Resend the invitation email to a pending invitation.',
        parameters=[
            OpenApiParameter(
                name='invitation_id',
                type=str,
                location=OpenApiParameter.PATH,
                description='UUID of the invitation to resend'
            )
        ],
        responses={
            200: OpenApiResponse(response=OrganizationInvitationSerializer, description='Invitation email resent successfully'),
            400: OpenApiResponse(response=ErrorResponseSerializer, description='Can only resend pending invitations'),
            403: OpenApiResponse(response=ErrorResponseSerializer, description='Permission denied'),
            404: OpenApiResponse(response=ErrorResponseSerializer, description='Invitation not found'),
        }
    )
    @action(detail=True, methods=['post'], url_path='invitations/(?P<invitation_id>[^/.]+)/resend')
    def resend_invitation(self, request, pk=None, invitation_id=None):
        """Resend a pending invitation."""
        organization = self.get_object()

        # Check if user is admin of this organization
        is_admin = OrganizationMembership.objects.filter(
            user=request.user,
            organization=organization,
            role=OrganizationMembership.Role.ADMIN
        ).exists()
        if not is_admin:
            raise PermissionDenied("You must be an admin of this organization to resend invitations.")

        invitation = get_object_or_404(
            OrganizationInvitation,
            id=invitation_id,
            organization=organization
        )

        if invitation.status != OrganizationInvitation.Status.PENDING:
            return Response(
                {'error': 'Can only resend pending invitations'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not invitation.is_valid():
            return Response(
                {'error': 'Cannot resend expired invitation. Please create a new invitation.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Send invitation email
        from apps.users.services.email_service import send_organization_invitation_email

        invited_by_name = request.user.get_full_name() or request.user.email
        email_sent = send_organization_invitation_email(
            email=invitation.email,
            token=str(invitation.token),
            organization_name=organization.name,
            invited_by_name=invited_by_name,
            role=invitation.role
        )

        if not email_sent:
            return Response(
                {'error': 'Failed to send invitation email. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        response_serializer = OrganizationInvitationSerializer(invitation)
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        operation_id='organizations_my_invitations',
        tags=['Organizations'],
        summary='List My Pending Invitations',
        description='Get a list of all pending invitations for the current user.',
        responses={
            200: OpenApiResponse(response=OrganizationInvitationSerializer(many=True), description='List of user\'s pending invitations'),
            401: OpenApiResponse(response=ErrorResponseSerializer, description='Authentication required'),
        }
    )
    @action(detail=False, methods=['get'])
    def my_invitations(self, request):
        """List all pending invitations for the current user."""
        invitations = OrganizationInvitation.objects.filter(
            email=request.user.email,
            status=OrganizationInvitation.Status.PENDING
        ).select_related('invited_by', 'organization')

        # Filter to only valid (non-expired) invitations
        valid_invitations = [inv for inv in invitations if inv.is_valid()]

        serializer = OrganizationInvitationSerializer(valid_invitations, many=True)
        return Response(serializer.data)

    @extend_schema(
        operation_id='organizations_preview_invitation',
        tags=['Organizations'],
        summary='Preview Invitation Details',
        description='View invitation details without authentication.',
        responses={
            200: OpenApiResponse(response=InvitationPreviewSerializer, description='Invitation details'),
            400: OpenApiResponse(response=ErrorResponseSerializer, description='Token is required'),
            404: OpenApiResponse(response=ErrorResponseSerializer, description='Invitation not found or expired'),
        }
    )
    @action(detail=False, methods=['get'], authentication_classes=[], permission_classes=[])
    def preview_invitation(self, request):
        """Preview invitation details without authentication."""
        token = request.query_params.get('token')

        if not token:
            return Response(
                {'error': 'Token parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            invitation = OrganizationInvitation.objects.select_related(
                'organization', 'invited_by'
            ).get(token=token)
        except OrganizationInvitation.DoesNotExist:
            return Response(
                {'error': 'Invitation not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if not invitation.is_valid():
            return Response(
                {'error': 'This invitation has expired or is no longer valid'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = InvitationPreviewSerializer(invitation)
        return Response(serializer.data)

    @extend_schema(
        operation_id='organizations_accept_invitation',
        tags=['Organizations'],
        summary='Accept Organization Invitation',
        description='Accept a pending invitation to join an organization.',
        request=AcceptInvitationSerializer,
        responses={
            200: OpenApiResponse(response=OrganizationMembershipSerializer, description='Invitation accepted successfully'),
            400: OpenApiResponse(response=ErrorResponseSerializer, description='Invalid or expired invitation'),
            401: OpenApiResponse(response=ErrorResponseSerializer, description='Authentication required'),
            404: OpenApiResponse(response=ErrorResponseSerializer, description='Invitation not found'),
        }
    )
    @action(detail=False, methods=['post'])
    def accept_invitation(self, request):
        """Accept an invitation to join an organization."""
        serializer = AcceptInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        token = serializer.validated_data['token']

        try:
            invitation = OrganizationInvitation.objects.select_related(
                'organization', 'invited_by'
            ).get(token=token)
        except OrganizationInvitation.DoesNotExist:
            return Response(
                {'error': 'Invitation not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if not invitation.is_valid():
            return Response(
                {'error': 'This invitation is no longer valid or has expired'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if invitation.email != request.user.email:
            return Response(
                {'error': 'This invitation is for a different email address'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            membership = invitation.accept(request.user)
            membership_serializer = OrganizationMembershipSerializer(membership)
            return Response(membership_serializer.data, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @extend_schema(
        operation_id='organizations_decline_invitation',
        tags=['Organizations'],
        summary='Decline Organization Invitation',
        description='Decline a pending invitation to join an organization.',
        request=AcceptInvitationSerializer,
        responses={
            200: OpenApiResponse(description='Invitation declined successfully'),
            400: OpenApiResponse(response=ErrorResponseSerializer, description='Invalid invitation'),
            401: OpenApiResponse(response=ErrorResponseSerializer, description='Authentication required'),
            404: OpenApiResponse(response=ErrorResponseSerializer, description='Invitation not found'),
        }
    )
    @action(detail=False, methods=['post'])
    def decline_invitation(self, request):
        """Decline an invitation to join an organization."""
        serializer = AcceptInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        token = serializer.validated_data['token']

        try:
            invitation = OrganizationInvitation.objects.get(token=token)
        except OrganizationInvitation.DoesNotExist:
            return Response(
                {'error': 'Invitation not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if invitation.email != request.user.email:
            return Response(
                {'error': 'This invitation is for a different email address'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            invitation.decline()
            return Response(
                {'message': 'Invitation declined successfully'},
                status=status.HTTP_200_OK
            )
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @extend_schema(
        operation_id='organizations_update_member_role',
        tags=['Organizations'],
        summary='Update Member Role',
        description='Promote or demote a member by updating their role (requires admin permissions).',
        parameters=[
            OpenApiParameter(
                name='user_id',
                type=str,
                location=OpenApiParameter.PATH,
                description='UUID of the user whose role to update'
            )
        ],
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'role': {
                        'type': 'string',
                        'enum': ['admin', 'member'],
                        'description': 'New role for the member'
                    },
                },
                'required': ['role'],
            }
        },
        responses={
            200: OpenApiResponse(response=OrganizationMembershipSerializer, description='Role updated successfully'),
            400: OpenApiResponse(response=ErrorResponseSerializer, description='Invalid role or cannot demote last admin'),
            401: OpenApiResponse(response=ErrorResponseSerializer, description='Authentication required'),
            403: OpenApiResponse(response=ErrorResponseSerializer, description='Permission denied'),
            404: OpenApiResponse(response=ErrorResponseSerializer, description='Member not found'),
        }
    )
    @action(detail=True, methods=['patch'], url_path='members/(?P<user_id>[^/.]+)/role')
    def update_member_role(self, request, pk=None, user_id=None):
        """Update a member's role (promote/demote)."""
        organization = self.get_object()

        # Check if requesting user is admin of this organization
        is_admin = OrganizationMembership.objects.filter(
            user=request.user,
            organization=organization,
            role=OrganizationMembership.Role.ADMIN
        ).exists()
        if not is_admin:
            raise PermissionDenied("You must be an admin of this organization to update member roles.")

        # Validate the new role
        new_role = request.data.get('role')
        if new_role not in ['admin', 'member']:
            return Response(
                {'error': 'Invalid role. Must be "admin" or "member".'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get the membership to update
        membership = get_object_or_404(
            OrganizationMembership,
            organization=organization,
            user_id=user_id
        )

        # Prevent demoting the last admin
        if membership.role == OrganizationMembership.Role.ADMIN and new_role == 'member':
            admin_count = OrganizationMembership.objects.filter(
                organization=organization,
                role=OrganizationMembership.Role.ADMIN
            ).count()
            if admin_count <= 1:
                return Response(
                    {'error': 'Cannot demote the last admin. Promote another member first.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Prevent users from changing their own role
        if str(membership.user_id) == str(request.user.id):
            return Response(
                {'error': 'You cannot change your own role.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update the role
        membership.role = new_role
        membership.save(update_fields=['role', 'updated_at'])

        serializer = OrganizationMembershipSerializer(membership)
        return Response(serializer.data, status=status.HTTP_200_OK)
