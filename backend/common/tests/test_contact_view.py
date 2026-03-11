"""
Tests for the public contact form endpoint.
"""
from unittest.mock import patch

import pytest
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APIClient


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.mark.django_db
class TestContactFormEndpoint:
    """Tests for POST /api/public/contact/."""

    URL = "/api/public/contact/"

    def test_valid_submission_sends_email_and_slack(self, client):
        payload = {
            "name": "Jane Doe",
            "email": "jane@example.com",
            "company": "Acme",
            "message": "We want to embed Pillar in our product.",
            "source_path": "/contact?ref=footer",
        }

        with (
            patch("common.views.contact.send_contact_submission_email", return_value=True) as mock_email,
            patch("common.views.contact.notify_contact_submission", return_value=True) as mock_slack,
        ):
            response = client.post(self.URL, payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["detail"] == "Thanks for reaching out. We'll get back to you soon."

        mock_email.assert_called_once()
        mock_slack.assert_called_once()

        email_kwargs = mock_email.call_args.kwargs
        assert email_kwargs["name"] == payload["name"]
        assert email_kwargs["email"] == payload["email"]
        assert email_kwargs["company"] == payload["company"]
        assert email_kwargs["message"] == payload["message"]
        assert email_kwargs["source_path"] == payload["source_path"]

    def test_missing_fields_return_validation_errors(self, client):
        response = client.post(self.URL, {"name": "", "email": "not-an-email"}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "errors" in response.data
        assert "name" in response.data["errors"]
        assert "email" in response.data["errors"]
        assert "company" in response.data["errors"]
        assert "message" in response.data["errors"]

    def test_invalid_source_path_is_rejected(self, client):
        payload = {
            "name": "Jane Doe",
            "email": "jane@example.com",
            "company": "Acme",
            "message": "Hello",
            "source_path": "contact",
        }

        response = client.post(self.URL, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["errors"]["source_path"] == ["Source path must start with '/'."]

    def test_email_failure_returns_service_unavailable(self, client):
        payload = {
            "name": "Jane Doe",
            "email": "jane@example.com",
            "company": "Acme",
            "message": "Hello",
        }

        with (
            patch("common.views.contact.send_contact_submission_email", return_value=False) as mock_email,
            patch("common.views.contact.notify_contact_submission", return_value=True) as mock_slack,
        ):
            response = client.post(self.URL, payload, format="json")

        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert "could not send your message" in response.data["detail"]
        mock_email.assert_called_once()
        mock_slack.assert_not_called()

    def test_slack_failure_does_not_fail_submission(self, client):
        payload = {
            "name": "Jane Doe",
            "email": "jane@example.com",
            "company": "Acme",
            "message": "Hello",
        }

        with (
            patch("common.views.contact.send_contact_submission_email", return_value=True) as mock_email,
            patch("common.views.contact.notify_contact_submission", return_value=False) as mock_slack,
        ):
            response = client.post(self.URL, payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        mock_email.assert_called_once()
        mock_slack.assert_called_once()

    def test_rate_limiting_applies_after_five_requests(self, client):
        with (
            patch("common.views.contact.send_contact_submission_email", return_value=True),
            patch("common.views.contact.notify_contact_submission", return_value=True),
        ):
            for index in range(5):
                response = client.post(
                    self.URL,
                    {
                        "name": "Jane Doe",
                        "email": f"jane{index}@example.com",
                        "company": "Acme",
                        "message": "Hello",
                    },
                    format="json",
                )
                assert response.status_code == status.HTTP_201_CREATED

            throttled_response = client.post(
                self.URL,
                {
                    "name": "Jane Doe",
                    "email": "jane6@example.com",
                    "company": "Acme",
                    "message": "Hello",
                },
                format="json",
            )

        assert throttled_response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
