from {{name_snake}} import hello


def test_hello() -> None:
    assert hello("{{name}}") == "Hello, {{name}}!"
