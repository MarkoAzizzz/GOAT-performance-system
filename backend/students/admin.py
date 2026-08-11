from django.contrib import admin
from .models import Branch, Student


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display = ['name', 'location', 'is_active']
    search_fields = ['name']


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ['student_id', 'full_name', 'sport', 'rating', 'branch', 'is_active', 'join_date']
    list_filter = ['sport', 'branch', 'is_active']
    search_fields = ['student_id', 'user__full_name', 'user__email']
    readonly_fields = ['id', 'created_at', 'updated_at']
