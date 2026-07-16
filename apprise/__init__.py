"""Local apprise service package.

Regular package (not namespace) so `apprise.setup` resolves here — by sys.path
order the project root wins — instead of the PyPI `apprise` library, which is
only installed inside the gateway container.
"""
