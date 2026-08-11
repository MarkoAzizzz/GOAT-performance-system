from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from core.responses import success_response
from .serializers import LeaderboardSerializer
from .services import get_leaderboard


class LeaderboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        entries = get_leaderboard(
            branch_id=request.query_params.get('branch'),
            sport=request.query_params.get('sport'),
        )
        return success_response(data=LeaderboardSerializer(entries, many=True).data)
