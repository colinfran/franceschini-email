from usesend import UseSend


def test_only_transactional_resources_are_available() -> None:
    client = UseSend("us_test")

    assert client.emails is not None
    assert client.domains is not None
    for resource in ("contacts", "contact_books", "contactBooks", "campaigns"):
        assert not hasattr(client, resource)
