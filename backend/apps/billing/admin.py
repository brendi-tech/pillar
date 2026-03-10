from django.contrib import admin

from apps.billing.models import BonusResponseGrant


class BonusResponseGrantInline(admin.TabularInline):
    model = BonusResponseGrant
    extra = 0
    fields = ["amount", "expires_at", "memo", "granted_by", "created_at"]
    readonly_fields = ["granted_by", "created_at"]


@admin.register(BonusResponseGrant)
class BonusResponseGrantAdmin(admin.ModelAdmin):
    list_display = ["organization", "amount", "expires_at", "memo", "is_active", "granted_by", "created_at"]
    list_filter = ["expires_at"]
    search_fields = ["organization__name", "memo"]
    ordering = ["-created_at"]
    readonly_fields = ["granted_by", "created_at"]
    autocomplete_fields = ["organization"]

    def save_model(self, request, obj, form, change):
        if not change:
            obj.granted_by = request.user
        super().save_model(request, obj, form, change)

    @admin.display(boolean=True, description="Active")
    def is_active(self, obj: BonusResponseGrant) -> bool:
        return obj.is_active
